const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const { 
  getStudentAttendance,
  getStudentClasses
} = require('../controllers/studentController');

const router = express.Router();

// All routes protected and require student role
router.use(auth, requireRole(['student']));

// Student Data
router.get('/attendance', getStudentAttendance);
router.get('/classes', getStudentClasses);

module.exports = router;