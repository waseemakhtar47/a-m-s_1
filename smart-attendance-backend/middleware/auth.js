const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔐 Auth Middleware - Token:', token);
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // ✅ Handle valid-token- format
    if (token.startsWith('valid-token-')) {
      const userId = token.replace('valid-token-', '');
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!user.isActive && user.role !== 'admin') {
        return res.status(401).json({ error: 'Account not activated' });
      }

      req.user = user;
      console.log('✅ Auth successful for:', user.firstName, user.role);
      return next();
    }

    return res.status(401).json({ error: 'Invalid token format' });

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

module.exports = { auth, requireRole };