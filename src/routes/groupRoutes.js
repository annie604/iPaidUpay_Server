const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticateToken = require('../middleware/authMiddleware');

// Get all groups for dashboard (Protected)
router.get('/', authenticateToken, groupController.getDashboardGroups);

module.exports = router;
