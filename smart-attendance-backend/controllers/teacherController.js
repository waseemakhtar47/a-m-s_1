const Class = require('../models/Class');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');


// Get teacher's classes - ULTRA FIXED VERSION
exports.getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user._id;

    console.log('🔍 Fetching classes for teacher:', teacherId);

    // ✅ ULTRA FIX: Better population with error handling
    const classes = await Class.find({
      $or: [
        { teacher: teacherId },
        { 'subjects.teacher': teacherId }
      ]
    })
    .populate('students', 'firstName lastName studentId')
    .populate({
      path: 'subjects.subject',
      model: 'Subject',
      select: 'name code'
    })
    .populate({
      path: 'subjects.teacher', 
      model: 'User',
      select: 'firstName lastName teacherId'
    })
    .populate('teacher', 'firstName lastName')
    .lean();

    console.log('📋 Raw Classes Found:', classes.length);
    
    // ✅ ULTRA FIX: Better filtering and validation
    const filteredClasses = classes.map(cls => {
      // Filter subjects where THIS teacher is assigned AND subject exists
      const teacherSubjects = cls.subjects.filter(sub => {
        if (!sub.teacher) return false;
        if (!sub.subject) return false; // ✅ Skip if subject is null
        return sub.teacher._id.toString() === teacherId.toString();
      });

      console.log(`Class ${cls.name}:`, {
        totalSubjects: cls.subjects?.length || 0,
        teacherSubjects: teacherSubjects.length,
        subjectNames: teacherSubjects.map(s => s.subject?.name)
      });

      return {
        ...cls,
        subjects: teacherSubjects
      };
    }).filter(cls => cls.subjects.length > 0);

    console.log('✅ Final Classes:', filteredClasses.length);
    
    res.json({ 
      success: true,
      classes: filteredClasses 
    });
  } catch (error) {
    console.error('❌ Get teacher classes error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch classes' 
    });
  }
};

// Get students by class
exports.getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    const classObj = await Class.findById(classId)
      .populate('students', 'firstName lastName studentId email phone');

    if (!classObj) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if teacher has access to this class
    const teacherId = req.user._id;
    const hasAccess = classObj.teacher?.toString() === teacherId.toString() ||
      classObj.subjects.some(s => s.teacher?.toString() === teacherId.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this class' });
    }

    res.json({ students: classObj.students });
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Mark attendance
exports.markAttendance = async (req, res) => {
  try {
    const { classId, subjectId, date, attendanceData } = req.body;
    const teacherId = req.user._id;

    // Validate class and subject access
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    const hasAccess = classObj.teacher?.toString() === teacherId.toString() ||
      classObj.subjects.some(s => 
        s.subject?.toString() === subjectId && s.teacher?.toString() === teacherId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const attendanceRecords = [];
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    // Create attendance records
    for (const [studentId, status] of Object.entries(attendanceData)) {
      // Check if attendance already exists for this student, subject, and date
      const existingAttendance = await Attendance.findOne({
        student: studentId,
        subject: subjectId,
        date: {
          $gte: new Date(today),
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      if (existingAttendance) {
        // Update existing record
        existingAttendance.status = status;
        existingAttendance.markedBy = teacherId;
        await existingAttendance.save();
        attendanceRecords.push(existingAttendance);
      } else {
        // Create new record
        const attendance = new Attendance({
          student: studentId,
          class: classId,
          subject: subjectId,
          date: today,
          status,
          markedBy: teacherId
        });
        await attendance.save();
        attendanceRecords.push(attendance);
      }
    }

    res.json({ 
      success: true, 
      message: 'Attendance marked successfully',
      records: attendanceRecords.length
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark attendance' });
  }
};

// Get attendance report
exports.getAttendanceReport = async (req, res) => {
  try {
    const { classId, subjectId, startDate, endDate } = req.query;
    const teacherId = req.user._id;

    // Build query
    const query = { markedBy: teacherId };
    
    if (classId) query.class = classId;
    if (subjectId) query.subject = subjectId;
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'firstName lastName studentId')
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .sort({ date: -1 });

    res.json({ report: attendance });
  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance report' });
  }
};