const Attendance = require('../models/Attendance');
const Class = require('../models/Class');

// Get student's attendance - FINAL FIXED VERSION
exports.getStudentAttendance = async (req, res) => {
  try {
    const studentId = req.user._id;
    
    console.log('📊 Getting attendance for student:', studentId);

    const attendance = await Attendance.find({ student: studentId })
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .populate('markedBy', 'firstName lastName')
      .sort({ date: -1 });

    console.log(`✅ Found ${attendance.length} attendance records`);

    res.json({ 
      success: true,
      attendance: attendance || [] 
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch attendance',
      attendance: [] 
    });
  }
};

// Get student's classes - FINAL FIXED VERSION  
exports.getStudentClasses = async (req, res) => {
  try {
    const studentId = req.user._id;

    const classes = await Class.find({ students: studentId })
      .populate('teacher', 'firstName lastName')
      .populate('subjects.subject', 'name code');

    res.json({ 
      success: true,
      classes: classes || [] 
    });
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch classes',
      classes: [] 
    });
  }
};