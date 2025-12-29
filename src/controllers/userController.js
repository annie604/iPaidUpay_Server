const userService = require('../services/userService');

// Search users by username or ID (partial match)
// Query parameter: q (string)
const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        // Keep basic validation in controller to ensure HTTP 400
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const userId = req.user.userId;
        const users = await userService.searchUsers(userId, q);

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addFriend = async (req, res) => {
    try {
        const userId = req.user.userId;
        const friendId = parseInt(req.body.friendId);

        if (!friendId) {
            return res.status(400).json({ error: 'friendId is required' });
        }

        if (userId === parseInt(friendId)) {
            return res.status(400).json({ error: 'Cannot add self as friend' });
        }

        await userService.addFriend(userId, friendId);

        res.json({ message: 'Friend added successfully' });
    } catch (error) {
        console.error('Add friend error:', error);
        if (error.message === 'Already friends') {
            return res.status(400).json({ error: 'Already friends' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getFriends = async (req, res) => {
    try {
        const userId = req.user.userId;
        const friends = await userService.getFriends(userId);
        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    searchUsers,
    addFriend,
    getFriends
};
