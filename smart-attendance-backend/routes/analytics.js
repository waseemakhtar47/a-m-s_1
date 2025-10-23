const express = require('express');
const { auth } = require('../middleware/auth');
const { getAnalyticsData } = require('../controllers/analyticsController');

const router = express.Router();

// All routes protected
router.use(auth);

// Analytics Data
router.get('/data', getAnalyticsData);

module.exports = router;