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
const Subject = require('../models/Subject'); // ✅ Subject import karo
const Class = require('../models/Class'); 

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

// ✅ Get all subjects with class counts
router.get('/subjects-with-classes', async (req, res) => {
  try {
    const subjects = await Subject.find().populate('classes', 'name section');
    
    res.json({ 
      success: true, 
      subjects: subjects.map(subject => ({
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        classes: subject.classes,
        createdAt: subject.createdAt
      }))
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ✅ Get subject details with class information
router.get('/subject/:id/details', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('classes', 'name section grade');
    
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    res.json({ 
      success: true, 
      subject: {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        classes: subject.classes,
        classCount: subject.classes.length,
        createdAt: subject.createdAt
      }
    });
  } catch (error) {
    console.error('Get subject details error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});





module.exports = router;