const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const { 
  getPendingUsers, 
  approveUser, 
  rejectUser, 
  createClass, 
  createSubject, 
  assignStudentToClass, 
  assignTeacherToClass,
  getAllData
} = require('../controllers/adminController');

const router = express.Router();

// All routes protected and require admin role
router.use(auth, requireRole(['admin']));

// User Management
router.get('/pending-users', getPendingUsers);
router.post('/approve-user', approveUser);
router.post('/reject-user', rejectUser);

// Class Management
router.post('/create-class', createClass);

// Subject Management
router.post('/create-subject', createSubject);

// Assignments
router.post('/assign-student', assignStudentToClass);
router.post('/assign-teacher', assignTeacherToClass);

// Data for integrations
router.get('/data', getAllData);

module.exports = router;