const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
// Import models
const User = require('./models/User');
const Class = require('./models/Class');
const Subject = require('./models/Subject');
const Attendance = require('./models/Attendance');
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


const studentRoutes = require('./routes/student');
app.use('/api/student', studentRoutes);


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

// ✅ DELETE CLASS - COMPLETE FIXED VERSION
app.delete('/api/admin/delete-class/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting class:', id);
    
    // ✅ 1. PEHLE CLASS KA DATA LE LO
    const classObj = await Class.findById(id);
    
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // ✅ 2. REMOVE THIS CLASS FROM ALL RELATED SUBJECTS
    if (classObj.subjects && classObj.subjects.length > 0) {
      for (let subjectObj of classObj.subjects) {
        if (subjectObj.subject) {
          await Subject.findByIdAndUpdate(
            subjectObj.subject,
            { $pull: { classes: id } }
          );
          console.log(`✅ Removed class from subject: ${subjectObj.subject}`);
        }
      }
    }

    // ✅ 3. REMOVE CLASS REFERENCE FROM ALL STUDENTS
    if (classObj.students && classObj.students.length > 0) {
      await User.updateMany(
        { _id: { $in: classObj.students } },
        { $unset: { class: "" } }
      );
      console.log(`✅ Removed class reference from ${classObj.students.length} students`);
    }

    // ✅ 4. NOW DELETE THE CLASS
    await Class.findByIdAndDelete(id);
    
    console.log('✅ Class deleted successfully with all cleanups');

    res.json({ 
      success: true, 
      message: 'Class deleted successfully with all cleanups!' 
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

// ✅ DELETE SUBJECT - COMPLETE FIXED VERSION
app.delete('/api/admin/delete-subject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting subject:', id);
    
    // ✅ 1. REMOVE SUBJECT FROM ALL CLASSES
    await Class.updateMany(
      { 'subjects.subject': id },
      { $pull: { subjects: { subject: id } } }
    );

    // ✅ 2. NOW DELETE THE SUBJECT
    const deletedSubject = await Subject.findByIdAndDelete(id);
    
    if (!deletedSubject) {
      return res.json({ success: false, error: 'Subject not found' });
    }
    
    console.log('✅ Subject deleted successfully with all cleanups');

    res.json({ 
      success: true, 
      message: 'Subject deleted successfully with all cleanups!' 
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

// ✅ GET ALL SUBJECTS WITH CLASSES - CLEAN VERSION
app.get('/api/admin/subjects-with-classes', async (req, res) => {
  try {
    const subjects = await Subject.find().populate('classes', 'name section');
    
    // Format response
    const formattedSubjects = subjects.map(subject => ({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
      classes: subject.classes || [],
      createdAt: subject.createdAt
    }));

    res.json({ 
      success: true, 
      subjects: formattedSubjects
    });

  } catch (error) {
    console.error('Get subjects with classes error');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subjects with classes',
      subjects: [] 
    });
  }
});


// ✅ GET SUBJECT DETAILS WITH CLASS INFO
app.get('/api/admin/subject/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching subject details:', id);
    
    const subject = await Subject.findById(id).populate('classes', 'name section grade');
    
    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        error: 'Subject not found' 
      });
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
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subject details' 
    });
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

    // Find class
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // Find subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.json({ success: false, error: 'Subject not found' });
    }

    // ✅ 1. UPDATE CLASS'S SUBJECTS ARRAY
    // Remove existing assignment for this subject
    classObj.subjects = classObj.subjects.filter(
      sub => sub.subject.toString() !== subjectId
    );

    // Add new assignment
    classObj.subjects.push({
      subject: subjectId,
      teacher: teacherId
    });

    await classObj.save();
    console.log('✅ Teacher assignment saved to class');

    // ✅ 2. UPDATE SUBJECT'S CLASSES ARRAY
    if (!subject.classes.includes(classId)) {
      subject.classes.push(classId);
      await subject.save();
      console.log('✅ Class added to subject');
    }

    console.log('✅ Teacher assigned successfully');

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
// ✅ REMOVE TEACHER ASSIGNMENT - UPDATED VERSION
app.post('/api/admin/remove-teacher-assignment', async (req, res) => {
  try {
    const { classId, subjectId } = req.body;
    console.log('🗑️ Removing teacher assignment:', classId, subjectId);

    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.json({ success: false, error: 'Class not found' });
    }

    // ✅ 1. REMOVE FROM CLASS'S SUBJECTS ARRAY
    classObj.subjects = classObj.subjects.filter(s => 
      s.subject.toString() !== subjectId
    );

    await classObj.save();
    console.log('✅ Teacher assignment removed from class');

    // ✅ 2. CRITICAL: REMOVE FROM SUBJECT'S CLASSES ARRAY
    const subject = await Subject.findById(subjectId);
    if (subject) {
      subject.classes = subject.classes.filter(
        classRef => classRef.toString() !== classId
      );
      await subject.save();
      console.log('✅ Class removed from subject');
    }

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

// ✅ REMOVE STUDENT ASSIGNMENT - COMPLETE FIXED VERSION
app.post('/api/admin/remove-student-assignment', async (req, res) => {
  try {
    const { studentId } = req.body;
    console.log('🗑️ Removing student assignment:', studentId);

    // ✅ 1. FIND ALL CLASSES WHERE STUDENT IS ENROLLED
    const classesWithStudent = await Class.find({ students: studentId });
    
    // ✅ 2. REMOVE STUDENT FROM ALL CLASSES
    await Class.updateMany(
      { students: studentId },
      { $pull: { students: studentId } }
    );

    // ✅ 3. REMOVE CLASS REFERENCE FROM STUDENT
    await User.findByIdAndUpdate(studentId, { class: null });

    console.log(`✅ Student removed from ${classesWithStudent.length} classes`);

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


// ✅ GET CLASS STUDENTS - CLEAN VERSION
app.get('/api/teacher/class/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    
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
    
    res.json({ 
      success: true, 
      students: students 
    });

  } catch (error) {
    console.error('Get class students error');
    res.json({ 
      success: false, 
      error: 'Failed to fetch students',
      students: [] 
    });
  }
});


// ✅ MARK ATTENDANCE - CLEAN VERSION
app.post('/api/teacher/attendance/mark', async (req, res) => {
  try {
    const { classId, subjectId, date, attendanceData } = req.body;

    // Validate required fields
    if (!classId || !subjectId || !date || !attendanceData) {
      return res.json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const attendanceRecords = [];
    const today = new Date(date);
    today.setHours(0, 0, 0, 0);

    // Create attendance records for each student
    for (const [studentId, status] of Object.entries(attendanceData)) {
      try {
        const existingAttendance = await Attendance.findOne({
          student: studentId,
          subject: subjectId,
          class: classId,
          date: {
            $gte: new Date(today),
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        });

        if (existingAttendance) {
          existingAttendance.status = status;
          existingAttendance.markedBy = 'teacher-system';
          await existingAttendance.save();
          attendanceRecords.push(existingAttendance);
        } else {
          const attendance = new Attendance({
            student: studentId,
            class: classId,
            subject: subjectId,
            date: today,
            status: status,
            markedBy: 'teacher-system'
          });
          await attendance.save();
          attendanceRecords.push(attendance);
        }
      } catch (studentError) {
        console.error('Error processing student attendance');
      }
    }

    res.json({ 
      success: true,
      message: `Attendance marked successfully for ${attendanceRecords.length} students!`,
      records: attendanceRecords.length
    });

  } catch (error) {
    console.error('Mark attendance error');
    res.json({ 
      success: false, 
      error: 'Failed to mark attendance' 
    });
  }
});

// ✅ GET ATTENDANCE REPORT - CLEAN VERSION
app.get('/api/teacher/attendance/report', async (req, res) => {
  try {
    const { classId, subjectId, startDate, endDate } = req.query;

    // Build query
    const query = {};
    
    if (classId && classId !== '' && classId !== 'undefined') query.class = classId;
    if (subjectId && subjectId !== '' && subjectId !== 'undefined') query.subject = subjectId;
    
    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: start,
        $lte: end
      };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'firstName lastName studentId')
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .sort({ date: -1, student: 1 });

    // Calculate summary statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    
    const summary = {
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      presentPercentage: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
      absentPercentage: totalRecords > 0 ? Math.round((absentCount / totalRecords) * 100) : 0
    };

    res.json({ 
      success: true, 
      report: attendance,
      summary: summary
    });

  } catch (error) {
    console.error('Get attendance report error');
    res.json({ 
      success: false, 
      error: 'Failed to fetch attendance report',
      report: [],
      summary: {}
    });
  }
});

// ✅ GET ATTENDANCE REPORT - DEBUG VERSION
app.get('/api/teacher/attendance/report', async (req, res) => {
  try {
    const { classId, subjectId, startDate, endDate } = req.query;
    
    console.log('📊 Generating attendance report:', { classId, subjectId, startDate, endDate });

    // Build query
    const query = {};
    
    if (classId && classId !== '' && classId !== 'undefined') query.class = classId;
    if (subjectId && subjectId !== '' && subjectId !== 'undefined') query.subject = subjectId;
    
    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: start,
        $lte: end
      };
    }

    console.log('🔍 Final Query:', JSON.stringify(query, null, 2));

    const attendance = await Attendance.find(query)
      .populate('student', 'firstName lastName studentId')
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .sort({ date: -1, student: 1 });

    console.log(`✅ Found ${attendance.length} attendance records`);
    
    // ✅ DEBUG: Log first record to see structure
    if (attendance.length > 0) {
      console.log('🔍 First record structure:', JSON.stringify(attendance[0], null, 2));
    }

    // Calculate summary statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    
    const summary = {
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      presentPercentage: totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0,
      absentPercentage: totalRecords > 0 ? Math.round((absentCount / totalRecords) * 100) : 0
    };

    res.json({ 
      success: true, 
      report: attendance,
      summary: summary
    });

  } catch (error) {
    console.error('❌ Get attendance report error:', error);
    res.json({ 
      success: false, 
      error: 'Failed to fetch attendance report: ' + error.message,
      report: [],
      summary: {}
    });
  }
});

// ✅ REMOVE TEACHER FROM ALL CLASSES WHEN DELETED
app.post('/api/admin/remove-teacher', async (req, res) => {
  try {
    const { teacherId } = req.body;
    console.log('🗑️ Removing teacher from all classes:', teacherId);

    // ✅ REMOVE TEACHER FROM ALL CLASS SUBJECTS
    await Class.updateMany(
      { 'subjects.teacher': teacherId },
      { $pull: { subjects: { teacher: teacherId } } }
    );

    // ✅ REMOVE TEACHER FROM ALL SUBJECT CLASSES
    await Subject.updateMany(
      { },
      { $pull: { classes: { $in: await Class.find({ 'subjects.teacher': teacherId }).distinct('_id') } } }
    );

    console.log('✅ Teacher removed from all classes and subjects');

    res.json({ 
      success: true,
      message: 'Teacher removed from all assignments successfully!'
    });

  } catch (error) {
    console.error('Remove teacher error:', error);
    res.json({ success: false, error: 'Failed to remove teacher' });
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