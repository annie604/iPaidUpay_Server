import express from 'express';
import * as groupController from '../controllers/groupController';
import authenticateToken from '../middleware/authMiddleware';

const router = express.Router();

// Get all groups for dashboard (Protected)
router.get('/', authenticateToken, groupController.getDashboardGroups);

// Create a new group (Protected)
router.post('/', authenticateToken, groupController.createGroup);

// Update a group (Protected)
router.put('/:id', authenticateToken, groupController.updateGroup);

// Update group status (Protected)
router.put('/:id/status', authenticateToken, groupController.updateGroupStatus);

// Delete a group (Protected)
router.delete('/:id', authenticateToken, groupController.deleteGroup);

export default router;
