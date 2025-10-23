const QRCode = require('qr-image');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');

// Generate QR Code
exports.generateQRCode = async (req, res) => {
  try {
    const { classId, subjectId, duration } = req.body;
    const teacherId = req.user._id;

    // Validate access
    const classObj = await Class.findById(classId);
    const subject = await Subject.findById(subjectId);

    if (!classObj || !subject) {
      return res.status(404).json({ success: false, error: 'Class or subject not found' });
    }

    const hasAccess = classObj.teacher?.toString() === teacherId.toString() ||
      classObj.subjects.some(s => 
        s.subject?.toString() === subjectId && s.teacher?.toString() === teacherId.toString()
      );

    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Create QR data
    const qrData = JSON.stringify({
      classId,
      subjectId,
      teacherId,
      timestamp: Date.now(),
      duration: parseInt(duration) || 10
    });

    // Generate QR code
    const qrCode = QRCode.image(qrData, { type: 'svg' });
    let qrString = '';
    
    qrCode.on('data', (chunk) => {
      qrString += chunk;
    });

    qrCode.on('end', () => {
      res.json({
        success: true,
        qrData: qrData,
        qrSvg: qrString,
        expiresIn: duration
      });
    });

  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
};

// Mark attendance via QR code
exports.markAttendanceQR = async (req, res) => {
  try {
    const { studentId, qrData } = req.body;

    // Parse QR data
    let qrInfo;
    try {
      qrInfo = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Invalid QR code data' });
    }

    const { classId, subjectId, teacherId, timestamp, duration } = qrInfo;

    // Check if QR code is expired
    const currentTime = Date.now();
    const qrAge = currentTime - timestamp;
    const qrMaxAge = (duration || 10) * 60 * 1000; // Convert to milliseconds

    if (qrAge > qrMaxAge) {
      return res.status(400).json({ success: false, error: 'QR code has expired' });
    }

    // Validate student
    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found or not active' });
    }

    // Check if student belongs to the class
    const classObj = await Class.findById(classId);
    if (!classObj || !classObj.students.includes(studentId)) {
      return res.status(400).json({ success: false, error: 'Student not in this class' });
    }

    // Check if attendance already marked for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      student: studentId,
      subject: subjectId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingAttendance) {
      return res.status(400).json({ success: false, error: 'Attendance already marked for today' });
    }

    // Create attendance record
    const attendance = new Attendance({
      student: studentId,
      class: classId,
      subject: subjectId,
      date: today,
      status: 'present',
      markedBy: teacherId,
      qrCode: qrData
    });

    await attendance.save();

    res.json({ 
      success: true, 
      message: 'Attendance marked successfully via QR code' 
    });

  } catch (error) {
    console.error('Mark attendance QR error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark attendance' });
  }
};