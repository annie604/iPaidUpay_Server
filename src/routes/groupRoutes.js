const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticateToken = require('../middleware/authMiddleware');

// Get all groups for dashboard (Protected)
router.get('/', authenticateToken, groupController.getDashboardGroups);

// Create a new group (Protected)
// Create a new group (Protected)
router.post('/', authenticateToken, groupController.createGroup);

// Update a group (Protected)
router.put('/:id', authenticateToken, groupController.updateGroup);

// Delete a group (Protected)
router.delete('/:id', authenticateToken, groupController.deleteGroup);

module.exports = router;
