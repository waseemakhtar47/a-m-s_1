const Attendance = require('../models/Attendance');
const Class = require('../models/Class');

// Get student's attendance
exports.getStudentAttendance = async (req, res) => {
  try {
    const studentId = req.user._id;

    const attendance = await Attendance.find({ student: studentId })
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .populate('markedBy', 'firstName lastName')
      .sort({ date: -1 });

    res.json({ attendance });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// Get student's classes
exports.getStudentClasses = async (req, res) => {
  try {
    const studentId = req.user._id;

    const classes = await Class.find({ students: studentId })
      .populate('teacher', 'firstName lastName')
      .populate('subjects.subject', 'name code');

    res.json({ classes });
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
};