const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');

// Route to execute SQL, protected by auth middleware
// Controller also checks for specific username 'Admin'
router.post('/sql', authenticateToken, adminController.executeSql);

module.exports = router;
