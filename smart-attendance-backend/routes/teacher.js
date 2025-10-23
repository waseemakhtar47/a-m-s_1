const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const { 
  getTeacherClasses,
  getClassStudents,
  markAttendance,
  getAttendanceReport
} = require('../controllers/teacherController');

const router = express.Router();

// All routes protected and require teacher role
router.use(auth, requireRole(['teacher']));

// Class Management
router.get('/classes', getTeacherClasses);
router.get('/class/:classId/students', getClassStudents);

// Attendance
router.post('/attendance/mark', markAttendance);
router.get('/attendance/report', getAttendanceReport);

module.exports = router;