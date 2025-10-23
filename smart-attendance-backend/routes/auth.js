const express = require('express');
const { register, login, sendEmailOTP, sendSMSOTP, verifyOTP, resetPassword } = require('../controllers/authController');
const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/forgot-password/send-email
// @desc    Send OTP via email
// @access  Public
router.post('/forgot-password/send-email', sendEmailOTP);

// @route   POST /api/auth/forgot-password/send-sms
// @desc    Send OTP via SMS
// @access  Public
router.post('/forgot-password/send-sms', sendSMSOTP);

// @route   POST /api/auth/forgot-password/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/forgot-password/verify-otp', verifyOTP);

// @route   POST /api/auth/forgot-password/reset
// @desc    Reset password
// @access  Public
router.post('/forgot-password/reset', resetPassword);

module.exports = router;