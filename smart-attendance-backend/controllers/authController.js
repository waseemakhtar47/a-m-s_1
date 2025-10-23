const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Register user
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role, studentId, teacherId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }, { studentId }, { teacherId }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email, phone, or ID already exists' 
      });
    }

    // For admin, check if it's the first user
    if (role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Admin registration is only allowed for the first user' 
        });
      }
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      studentId,
      teacherId,
      isActive: role === 'admin' // Auto-activate admin
    });

    await user.save();

    // Generate token for auto-login if admin
    let token;
    if (role === 'admin') {
      token = generateToken(user._id);
    }

    res.status(201).json({
      success: true,
      message: role === 'admin' ? 'Admin registered successfully' : 'Registration successful. Wait for admin approval.',
      token: token,
      user: {
        id: user._id,
        name: `${firstName} ${lastName}`,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password, role } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone }
      ],
      role: role
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Account not activated. Please wait for admin approval.' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        role: user.role,
        studentId: user.studentId,
        teacherId: user.teacherId,
        class: user.class,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
};

// OTP storage (in production, use Redis)
const otpStore = new Map();

// Send OTP via Email
exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(email, { otp, expiresAt });

    // In production, send actual email
    console.log(`OTP for ${email}: ${otp}`); // For development

    res.json({ 
      success: true, 
      message: 'OTP sent to email successfully',
      otp: otp // Remove in production
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
};

// Send OTP via SMS
exports.sendSMSOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(phone, { otp, expiresAt });

    // In production, send actual SMS using Twilio
    console.log(`OTP for ${phone}: ${otp}`); // For development

    res.json({ 
      success: true, 
      message: 'OTP sent via SMS successfully',
      otp: otp // Remove in production
    });

  } catch (error) {
    console.error('Send SMS OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP via SMS' });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { contact, otp } = req.body;

    const storedData = otpStore.get(contact);
    
    if (!storedData) {
      return res.status(400).json({ success: false, error: 'OTP not found or expired' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(contact);
      return res.status(400).json({ success: false, error: 'OTP expired' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }

    // OTP verified successfully
    otpStore.set(contact, { ...storedData, verified: true });

    res.json({ success: true, message: 'OTP verified successfully' });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { contact, contactType, newPassword } = req.body;

    const storedData = otpStore.get(contact);
    
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ success: false, error: 'OTP not verified' });
    }

    // Find user by email or phone
    const query = contactType === 'email' ? { email: contact } : { phone: contact };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Clear OTP
    otpStore.delete(contact);

    res.json({ success: true, message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};