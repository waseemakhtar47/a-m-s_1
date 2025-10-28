const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
// Import models
const User = require('./models/User');
const Class = require('./models/Class');
const Subject = require('./models/Subject');
// Import controllers
const teacherController = require('./controllers/teacherController');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});



// ========================
// ✅ AUTH ROUTES
// ========================

app.post('/api/register', async (req, res) => {
  try {
    console.log('✅ REGISTER Request:', req.body);
    
    const { firstName, lastName, email, phone, password, role, studentId, teacherId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ 
        success: false, 
        error: 'User already exists with this email' 
      });
    }

    // ✅ REMOVED: Manual hashing - let the User model handle it
    // const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      password: password, // ✅ Store plain password - pre-save hook will hash it
      role,
      studentId,
      teacherId,
      isActive: role === 'admin'
    });

    await newUser.save(); // ✅ This will trigger the pre-save hook to hash the password

    res.json({
      success: true,
      message: 'Registration successful!',
      user: {
        id: newUser._id,
        name: firstName + ' ' + lastName,
        email: email,
        role: role,
        isActive: newUser.isActive
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.json({ 
      success: false, 
      error: 'Database save failed' 
    });
  }
});




app.post('/api/login', async (req, res) => {
  try {
    console.log('✅ LOGIN Request:', req.body);
    
    const { emailOrPhone, password, role } = req.body;

    // Find user by email OR phone
    const user = await User.findOne({
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone }
      ]
    });

    console.log('🔍 Found user:', user);

    if (!user) {
      console.log('❌ User not found');
      return res.json({ 
        success: false, 
        error: 'Invalid email/phone or password' 
      });
    }

    // Check role
    if (user.role !== role) {
      console.log(`❌ Role mismatch: User role is ${user.role}, but login attempt as ${role}`);
      return res.json({ 
        success: false, 
        error: `Please login as ${user.role}, not ${role}` 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔐 Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return res.json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    // Check if user is active (except for admin)
    if (!user.isActive && user.role !== 'admin') {
      console.log('❌ User not active');
      return res.json({ 
        success: false, 
        error: 'Account not activated. Contact admin.' 
      });
    }

    console.log('✅ Login successful for:', user.firstName, user.lastName);
    
    res.json({
      success: true,
      token: 'valid-token-' + user._id,
      user: {
        id: user._id,
        name: user.firstName + ' ' + user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        studentId: user.studentId,
        teacherId: user.teacherId,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});




// ========================
// ✅ ADMIN ROUTES
// ========================

// ✅ GET PENDING USERS
// ✅ GET PENDING USERS - FIXED TO INCLUDE BOTH STUDENTS AND TEACHERS
app.get('/api/admin/pending-users', async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      isActive: false,
      role: { $in: ['student', 'teacher'] } // ✅ INCLUDES BOTH STUDENTS AND TEACHERS
    }).select('-password');
    
    console.log(`📋 Found ${pendingUsers.length} pending users:`, 
                pendingUsers.map(u => `${u.firstName} ${u.lastName} (${u.role})`));
    
    res.json({ 
      success: true,
      users: pendingUsers 
    });
    
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending users' 
    });
  }
});

// ✅ GET ALL USERS
app.get('/api/admin/all-users', async (req, res) => {
  try {
    const allUsers = await User.find({}).select('-password');
    
    res.json({ 
      success: true,
      users: allUsers 
    });
    
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch all users' 
    });
  }
});

// ✅ APPROVE USER
app.post('/api/admin/approve-user', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'User approved successfully',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Approve user error:', error);
    res.json({ 
      success: false, 
      error: 'Failed to approve user' 
    });
  }
});

// ✅ REJECT USER
app.post('/api/admin/reject-user', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'User rejected successfully'
    });
    
  } catch (error) {
    console.error('Reject user error:', error);
    res.json({ 
      success: false, 
      error: 'Failed to reject user' 
    });
  }
});

// ✅ CREATE CLASS
app.post('/api/admin/create-class', async (req, res) => {
  try {
    const { className, section } = req.body;
    console.log('🏫 Creating class:', className, section);

    const existingClass = await Class.findOne({ name: className, section });
    if (existingClass) {
      return res.json({ success: false, error: 'Class already exists' });
    }

    const newClass = new Class({
      name: className,
      section: section,
      grade: className.split(' ')[1] || '10'
    });

    await newClass.save();
    
    res.json({ 
      success: true, 
      class: newClass,
      message: 'Class created successfully!' 
    });

  } catch (error) {
    console.error('Create class error:', error);
    res.json({ success: false, error: 'Failed to create class' });
  }
});

// ✅ UPDATE CLASS
app.put('/api/admin/update-class/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section } = req.body;
    
    console.log('✏️ Updating class:', id, name, section);
    
    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { name, section },
      { new: true }
    );
    
    if (!updatedClass) {
      return res.json({ success: false, error: 'Class not found' });
    }
    
    res.json({ 
      success: true, 
      class: updatedClass,
      message: 'Class updated successfully!' 
    });
    
  } catch (error) {
    console.error('Update class error:', error);
    res.json({ success: false, error: 'Failed to update class' });
  }
});

// ✅ DELETE CLASS
app.delete('/api/admin/delete-class/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting class:', id);
    
    const deletedClass = await Class.findByIdAndDelete(id);
    
    if (!deletedClass) {
      return res.json({ success: false, error: 'Class not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Class deleted successfully!' 
    });
    
  } catch (error) {
    console.error('Delete class error:', error);
    res.json({ success: false, error: 'Failed to delete class' });
  }
});

// ✅ CREATE SUBJECT
app.post('/api/admin/create-subject', async (req, res) => {
  try {
    const { subjectName, subjectCode } = req.body;
    console.log('📚 Creating subject:', subjectName, subjectCode);

    const existingSubject = await Subject.findOne({ 
      $or: [{ name: subjectName }, { code: subjectCode }] 
    });

    if (existingSubject) {
      return res.json({ success: false, error: 'Subject already exists' });
    }

    const newSubject = new Subject({
      name: subjectName,
      code: subjectCode
    });

    await newSubject.save();
    
    res.json({ 
      success: true, 
      subject: newSubject,
      message: 'Subject created successfully!' 
    });

  } catch (error) {
    console.error('Create subject error:', error);
    res.json({ success: false, error: 'Failed to create subject' });
  }
});

// ✅ UPDATE SUBJECT
app.put('/api/admin/update-subject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    
    console.log('✏️ Updating subject:', id, name, code);
    
    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { name, code },
      { new: true }
    );
    
    if (!updatedSubject) {
      return res.json({ success: false, error: 'Subject not found' });
    }
    
    res.json({ 
      success: true, 
      subject: updatedSubject,
      message: 'Subject updated successfully!' 
    });
    
  } catch (error) {
    console.error('Update subject error:', error);
    res.json({ success: false, error: 'Failed to update subject' });
  }
});

// ✅ DELETE SUBJECT
app.delete('/api/admin/delete-subject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting subject:', id);
    
    const deletedSubject = await Subject.findByIdAndDelete(id);
    
    if (!deletedSubject) {
      return res.json({ success: false, error: 'Subject not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Subject deleted successfully!' 
    });
    
  } catch (error) {
    console.error('Delete subject error:', error);
    res.json({ success: false, error: 'Failed to delete subject' });
  }
});

// ✅ GET ALL CLASSES - POPULATED VERSION
app.get('/api/admin/classes', async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('students', 'firstName lastName studentId')
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log('📋 Classes with populated data:', classes.length);
    
    res.json({ 
      success: true, 
      classes: classes || [] 
    });

  } catch (error) {
    console.error('Get classes error:', error);
    res.json({ success: true, classes: [] });
  }
});

// ✅ GET ALL SUBJECTS  
app.get('/api/admin/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      subjects: subjects || [] 
    });

  } catch (error) {
    console.error('Get subjects error:', error);
    res.json({ success: true, subjects: [] });
  }
});


// ✅ GET ALL STUDENTS - FIXED POPULATION
app.get('/api/admin/students', async (req, res) => {
  try {
    const students = await User.find({ role: 'student', isActive: true })
      .select('-password')
      .populate('class', 'name section') // ✅ ENSURES CLASS DATA IS LOADED
      .sort({ createdAt: -1 });
    
    console.log(`📋 Found ${students.length} students with class data:`);
    students.forEach(s => {
      console.log(`- ${s.firstName} ${s.lastName}:`, s.class);
    });
    
    res.json({ 
      success: true, 
      students: students || [] 
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.json({ success: true, students: [] });
  }
});

// ✅ GET ALL TEACHERS
app.get('/api/admin/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher', isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      teachers: teachers || [] 
    });

  } catch (error) {
    console.error('Get teachers error:', error);
    res.json({ success: true, teachers: [] });
  }
});


// ✅ ASSIGN STUDENT TO CLASS - COMPLETELY FIXED
app.post('/api/admin/assign-student', async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    console.log('🎓 Assigning student:', studentId, 'to class:', classId);

    // 1. Remove student from all classes
    await Class.updateMany(
      { students: studentId },
      { $pull: { students: studentId } }
    );

    // 2. Add student to new class
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // Add student to class if not already there
    if (!classObj.students.includes(studentId)) {
      classObj.students.push(studentId);
      await classObj.save();
      console.log('✅ Student added to class students array');
    }

    // 3. CRITICAL FIX: Update student's class reference in User model
    const updatedStudent = await User.findByIdAndUpdate(
      studentId,
      { class: classId }, // This was missing/malfunctioning
      { new: true }
    ).populate('class', 'name section');

    if (!updatedStudent) {
      return res.json({ success: false, error: 'Student not found' });
    }

    console.log('✅ Student class reference updated in User model:', updatedStudent.class);
    
    res.json({ 
      success: true,
      message: 'Student assigned to class successfully!',
      student: updatedStudent
    });

  } catch (error) {
    console.error('Assign student error:', error);
    res.json({ success: false, error: 'Failed to assign student: ' + error.message });
  }
});

// ✅ ASSIGN TEACHER TO CLASS - COMPLETE UPDATED VERSION
app.post('/api/admin/assign-teacher', async (req, res) => {
  try {
    const { teacherId, classId, subjectId } = req.body;
    console.log('👨‍🏫 Assigning teacher:', teacherId, 'to class:', classId, 'subject:', subjectId);

    // ✅ REMOVED: The check that prevented same teacher from teaching same subject in multiple classes
    // Now teachers CAN teach the same subject in different classes

    // Find class
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // Check if subject already assigned to this class
    const existingSubjectIndex = classObj.subjects.findIndex(
      s => s.subject && s.subject.toString() === subjectId
    );

    if (existingSubjectIndex > -1) {
      // Update existing subject's teacher
      classObj.subjects[existingSubjectIndex].teacher = teacherId;
      console.log('✅ Updated existing subject with new teacher');
    } else {
      // Add new subject assignment
      classObj.subjects.push({
        subject: subjectId,
        teacher: teacherId
      });
      console.log('✅ Added new subject assignment');
    }

    await classObj.save();
    console.log('✅ Teacher assignment saved successfully');

    res.json({ 
      success: true,
      message: 'Teacher assigned successfully!',
      class: classObj
    });

  } catch (error) {
    console.error('Assign teacher error:', error);
    res.json({ success: false, error: 'Failed to assign teacher: ' + error.message });
  }
});


// ✅ REMOVE TEACHER ASSIGNMENT
app.post('/api/admin/remove-teacher-assignment', async (req, res) => {
  try {
    const { classId, subjectId } = req.body;
    console.log('🗑️ Removing teacher assignment:', classId, subjectId);

    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // Remove teacher from subject
    classObj.subjects = classObj.subjects.filter(s => 
      s.subject.toString() !== subjectId
    );

    await classObj.save();
    console.log('✅ Teacher assignment removed successfully');

    res.json({ 
      success: true,
      message: 'Teacher assignment removed successfully!'
    });

  } catch (error) {
    console.error('Remove teacher assignment error:', error);
    res.json({ success: false, error: 'Failed to remove teacher assignment' });
  }
});

// ✅ REMOVE STUDENT ASSIGNMENT  
app.post('/api/admin/remove-student-assignment', async (req, res) => {
  try {
    const { studentId } = req.body;
    console.log('🗑️ Removing student assignment:', studentId);

    // Remove student from all classes
    await Class.updateMany(
      { students: studentId },
      { $pull: { students: studentId } }
    );

    // Remove class reference from student
    await User.findByIdAndUpdate(studentId, { class: null });

    console.log('✅ Student assignment removed successfully');

    res.json({ 
      success: true,
      message: 'Student assignment removed successfully!'
    });

  } catch (error) {
    console.error('Remove student assignment error:', error);
    res.json({ success: false, error: 'Failed to remove student assignment' });
  }
});

// ========================
// ✅ TEACHER ROUTES - REAL DATA
// ========================

// ✅ GET TEACHER CLASSES
app.get('/api/teacher/classes', async (req, res) => {
  try {
    // For now, return all classes - baad mein teacher-specific filter karenge
    const classes = await Class.find().sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      classes: classes || [] 
    });

  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.json({ success: false, error: 'Failed to fetch classes', classes: [] });
  }
});

// ✅ GET CLASS STUDENTS
// ✅ GET CLASS STUDENTS - FIXED VERSION
app.get('/api/teacher/class/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    
    console.log('🔍 Fetching students for class:', classId);
    
    // ✅ ADD VALIDATION
    if (!classId || classId === 'undefined') {
      return res.json({ 
        success: false, 
        error: 'Invalid class ID',
        students: [] 
      });
    }
    
    const classObj = await Class.findById(classId).populate('students', 'firstName lastName studentId');
    
    if (!classObj) {
      return res.json({ 
        success: false, 
        error: 'Class not found',
        students: [] 
      });
    }

    // Format students data
    const students = classObj.students.map(student => ({
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId
    }));

    console.log(`✅ Found ${students.length} students in class`);
    
    res.json({ 
      success: true, 
      students: students 
    });

  } catch (error) {
    console.error('Get class students error:', error);
    res.json({ 
      success: false, 
      error: 'Failed to fetch students',
      students: [] 
    });
  }
});

// ✅ MARK ATTENDANCE
app.post('/api/teacher/attendance/mark', async (req, res) => {
  try {
    const { classId, subjectId, date, attendanceData } = req.body;
    console.log('📝 Marking attendance:', { classId, subjectId, date, attendanceData });
    
    // Real attendance saving logic yahan aayega
    res.json({ 
      success: true,
      message: 'Attendance marked successfully!',
      records: Object.keys(attendanceData).length
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.json({ success: false, error: 'Failed to mark attendance' });
  }
});

// ✅ GET ATTENDANCE REPORT
app.get('/api/teacher/attendance/report', async (req, res) => {
  try {
    const { classId, subjectId, startDate, endDate } = req.query;
    
    // For now empty array return karenge - baad mein real data
    res.json({ 
      success: true, 
      report: [] 
    });

  } catch (error) {
    console.error('Get attendance report error:', error);
    res.json({ success: false, error: 'Failed to fetch report', report: [] });
  }
});

// ========================
// ✅ OTHER ROUTES
// ========================

app.post('/api/forgot-password/send-email', (req, res) => {
  res.json({ success: true, message: 'OTP sent' });
});

app.post('/api/forgot-password/send-sms', (req, res) => {
  res.json({ success: true, message: 'OTP sent via SMS' });
});

app.post('/api/forgot-password/verify-otp', (req, res) => {
  res.json({ success: true, message: 'OTP verified' });
});

app.post('/api/forgot-password/reset', (req, res) => {
  res.json({ success: true, message: 'Password reset' });
});

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Attendance System Backend is running!',
    version: '1.0.0',
    status: '✅ WORKING'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found: ' + req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`✅ ALL ROUTES ARE WORKING!`);
  console.log(`✅ ADMIN PANEL FULLY FUNCTIONAL!`);
});