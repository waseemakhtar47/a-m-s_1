const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 3
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  studentId: {
    type: String,
    sparse: true
  },
  teacherId: {
    type: String,
    sparse: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ FIXED: Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ FIXED: Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

module.exports = mongoose.model('User', userSchema);