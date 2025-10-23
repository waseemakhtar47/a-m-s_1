const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Subject = require('../models/Subject');

// Get analytics data
exports.getAnalyticsData = async (req, res) => {
  try {
    const user = req.user;

    // Basic counts
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalClasses = await Class.countDocuments();
    const totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });

    // Overall attendance percentage
    const totalAttendanceRecords = await Attendance.countDocuments();
    const presentRecords = await Attendance.countDocuments({ status: 'present' });
    const overallAttendance = totalAttendanceRecords > 0 ? 
      Math.round((presentRecords / totalAttendanceRecords) * 100) : 0;

    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendanceRecords = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });
    const todayPresentRecords = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'present'
    });
    const todayAttendance = todayAttendanceRecords > 0 ?
      Math.round((todayPresentRecords / todayAttendanceRecords) * 100) : 0;

    // Subject-wise attendance
    const subjects = await Subject.find();
    const subjectAttendance = await Promise.all(
      subjects.map(async (subject) => {
        const subjectRecords = await Attendance.countDocuments({ subject: subject._id });
        const subjectPresent = await Attendance.countDocuments({ 
          subject: subject._id, 
          status: 'present' 
        });
        const percentage = subjectRecords > 0 ? 
          Math.round((subjectPresent / subjectRecords) * 100) : 0;
        
        return {
          subject: subject.name,
          percentage
        };
      })
    );

    // Recent activity
    const recentActivity = await Attendance.find()
      .populate('student', 'firstName lastName')
      .populate('subject', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .then(records => records.map(record => ({
        studentName: `${record.student.firstName} ${record.student.lastName}`,
        subjectName: record.subject.name,
        status: record.status === 'present' ? 'P' : 'A',
        time: record.createdAt
      })));

    // Class performance
    const classes = await Class.find().populate('students');
    const classPerformance = await Promise.all(
      classes.map(async (classObj) => {
        const classRecords = await Attendance.countDocuments({ class: classObj._id });
        const classPresent = await Attendance.countDocuments({ 
          class: classObj._id, 
          status: 'present' 
        });
        const attendance = classRecords > 0 ? 
          Math.round((classPresent / classRecords) * 100) : 0;
        
        return {
          className: `${classObj.name} - ${classObj.section}`,
          attendance,
          students: classObj.students.length
        };
      })
    );

    // Monthly trend (last 12 months)
    const monthlyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthRecords = await Attendance.countDocuments({
        date: { $gte: startOfMonth, $lte: endOfMonth }
      });
      const monthPresent = await Attendance.countDocuments({
        date: { $gte: startOfMonth, $lte: endOfMonth },
        status: 'present'
      });
      
      const percentage = monthRecords > 0 ? 
        Math.round((monthPresent / monthRecords) * 100) : 0;
      
      monthlyTrend.push(percentage);
    }

    res.json({
      totalStudents,
      totalClasses,
      totalTeachers,
      overallAttendance,
      todayAttendance,
      subjectAttendance,
      recentActivity,
      classPerformance,
      monthlyTrend
    });

  } catch (error) {
    console.error('Get analytics data error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
};