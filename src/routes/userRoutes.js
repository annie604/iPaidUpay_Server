const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

router.get('/search', userController.searchUsers);
router.get('/friends', userController.getFriends);
router.post('/friends', userController.addFriend);

module.exports = router;
