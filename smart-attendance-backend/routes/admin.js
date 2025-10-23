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
  getAllData,
  getAllUsers,
  getAllClasses,
  getAllSubjects,
  getAllStudents, 
  getAllTeachers
} = require('../controllers/adminController');

const router = express.Router();

// All routes protected and require admin role
router.use(auth, requireRole(['admin']));

// User Management
router.get('/pending-users', getPendingUsers);
router.get('/all-users', getAllUsers);
router.post('/approve-user', approveUser);
router.post('/reject-user', rejectUser);

// Class Management  
router.post('/create-class', createClass);
router.get('/classes', getAllClasses);

// Subject Management
router.post('/create-subject', createSubject);
router.get('/subjects', getAllSubjects);

// Student & Teacher Data
router.get('/students', getAllStudents); 
router.get('/teachers', getAllTeachers);

// Assignments
router.post('/assign-student', assignStudentToClass);
router.post('/assign-teacher', assignTeacherToClass);

// Data for integrations
router.get('/data', getAllData);

module.exports = router;