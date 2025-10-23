const express = require('express');
const { auth } = require('../middleware/auth');
const { 
  generateQRCode,
  markAttendanceQR
} = require('../controllers/integrationController');

const router = express.Router();

// All routes protected
router.use(auth);

// QR Code Integration
router.post('/generate-qr', generateQRCode);
router.post('/mark-attendance-qr', markAttendanceQR);

module.exports = router;