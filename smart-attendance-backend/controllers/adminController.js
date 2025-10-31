const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

// Get pending users
exports.getPendingUsers = async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      isActive: false,
      role: { $in: ['student', 'teacher'] }
    }).select('-password');

    res.json({ users: pendingUsers });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
};

// Approve user
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve user' });
  }
};

// Reject user
exports.rejectUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: 'User rejected successfully' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject user' });
  }
};

// Create class
exports.createClass = async (req, res) => {
  try {
    const { className, section } = req.body;

    const existingClass = await Class.findOne({ name: className, section });
    if (existingClass) {
      return res.status(400).json({ success: false, error: 'Class already exists' });
    }

    const grade = className.split(' ')[1]; // Extract grade from class name

    const newClass = new Class({
      name: className,
      section,
      grade
    });

    await newClass.save();

    res.json({ success: true, class: newClass });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, error: 'Failed to create class' });
  }
};

// Create subject
exports.createSubject = async (req, res) => {
  try {
    const { subjectName, subjectCode } = req.body;

    const existingSubject = await Subject.findOne({ 
      $or: [{ name: subjectName }, { code: subjectCode }] 
    });

    if (existingSubject) {
      return res.status(400).json({ success: false, error: 'Subject already exists' });
    }

    const newSubject = new Subject({
      name: subjectName,
      code: subjectCode
    });

    await newSubject.save();

    res.json({ success: true, subject: newSubject });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ success: false, error: 'Failed to create subject' });
  }
};

// Assign student to class
exports.assignStudentToClass = async (req, res) => {
  try {
    const { studentId, classId } = req.body;

    const student = await User.findById(studentId);
    const classObj = await Class.findById(classId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    if (!classObj) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    // Remove student from previous class if any
    await Class.updateMany(
      { students: studentId },
      { $pull: { students: studentId } }
    );

    // Add student to new class
    classObj.students.push(studentId);
    await classObj.save();

    // Update student's class reference
    student.class = classId;
    await student.save();

    res.json({ success: true, message: 'Student assigned to class successfully' });
  } catch (error) {
    console.error('Assign student error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign student' });
  }
};

// Assign teacher to class and subject
exports.assignTeacherToClass = async (req, res) => {  // ✅ exports add karo
  try {
    const { teacherId, classId, subjectId } = req.body;

    console.log('🔄 Assigning teacher:', { teacherId, classId, subjectId });

    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    // ✅ Pehle existing assignment remove karo
    classObj.subjects = classObj.subjects.filter(
      sub => sub.subject.toString() !== subjectId
    );

    // ✅ Naya assignment add karo
    classObj.subjects.push({
      subject: subjectId,
      teacher: teacherId
    });

    await classObj.save();

    // ✅ YEH NAYA CODE ADD KARO - Subject ke classes array ko update karo
    if (!subject.classes.includes(classId)) {
      subject.classes.push(classId);
      await subject.save();
      console.log(`✅ Added class ${classObj.name} to subject ${subject.name}`);
    }

    console.log(`✅ Teacher assigned: Class=${classObj.name}, Subject=${subject.name}`);

    res.json({ 
      success: true, 
      message: 'Teacher assigned successfully' 
    });

  } catch (error) {
    console.error('❌ Assign teacher error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Get all data for integrations
exports.getAllData = async (req, res) => {
  try {
    const classes = await Class.find().select('name section');
    const subjects = await Subject.find().select('name code');
    const students = await User.find({ role: 'student', isActive: true }).select('name studentId');
    const teachers = await User.find({ role: 'teacher', isActive: true }).select('name teacherId');

    res.json({
      classes,
      subjects,
      students,
      teachers
    });
  } catch (error) {
    console.error('Get all data error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('class', 'name section')
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get all classes - Ensure proper population
// Get all classes - FIXED VERSION
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('students', 'firstName lastName studentId')
      .populate('subjects.teacher', 'firstName lastName')
      .populate('subjects.subject', 'name code')
      .populate('teacher', 'firstName lastName')
      .lean(); // ✅ Added lean for better performance

    // ✅ FIX: Filter out null subjects before sending response
    const cleanedClasses = classes.map(cls => ({
      ...cls,
      subjects: cls.subjects ? cls.subjects.filter(sub => 
        sub.subject !== null && sub.subject !== undefined
      ) : []
    }));

    res.json({ classes: cleanedClasses });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
};

// Get all subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate('classes', 'name section')
      .sort({ createdAt: -1 });

    res.json({ subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
};

// Get all students - FIXED VERSION
exports.getAllStudents = async (req, res) => {
  try {
    console.log('🔄 Fetching all students with class data...');
    
    const students = await User.find({ 
      role: 'student'
    })
    .select('firstName lastName email phone studentId class isActive createdAt')
    .populate('class', 'name section') // ✅ Already correct
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${students.length} students`);
    
    // Debug logging
    students.forEach(student => {
      console.log(`🎓 ${student.firstName} ${student.lastName}:`, 
        student.class ? `${student.class.name} - ${student.class.section}` : 'No Class');
    });

    // ✅ FIX: Return success: true and proper structure
    res.json({ 
      success: true, 
      students: students
    });
    
  } catch (error) {
    console.error('❌ Get students error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch students' 
    });
  }
};


// Get all teachers  
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: 'teacher',
      isActive: true 
    })
    .select('firstName lastName email phone teacherId')
    .sort({ createdAt: -1 });

    res.json({ teachers });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
};