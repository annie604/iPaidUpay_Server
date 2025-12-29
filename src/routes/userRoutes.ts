import express from 'express';
import * as userController from '../controllers/userController';
import authenticateToken from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/search', userController.searchUsers);
router.get('/friends', userController.getFriends);
router.post('/friends', userController.addFriend);

export default router;
