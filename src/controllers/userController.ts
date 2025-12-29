import { Request, Response } from 'express';
import userService from '../services/userService';
import { AuthRequest } from '../middleware/authMiddleware';

// Search users by username or ID (partial match)
// Query parameter: q (string)
export const searchUsers = async (req: Request, res: Response) => {
    try {
        const { q } = req.query as { q: string };
        // Keep basic validation in controller to ensure HTTP 400
        if (!q) {
            res.status(400).json({ error: 'Query parameter "q" is required' });
            return;
        }

        const userId = (req as AuthRequest).user!.userId;
        const users = await userService.searchUsers(userId, q);

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addFriend = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const friendId = parseInt(req.body.friendId);

        if (!friendId) {
            res.status(400).json({ error: 'friendId is required' });
            return;
        }

        if (userId === friendId) {
            res.status(400).json({ error: 'Cannot add self as friend' });
            return;
        }

        await userService.addFriend(userId, friendId);

        res.json({ message: 'Friend added successfully' });
    } catch (error: any) {
        console.error('Add friend error:', error);
        if (error.message === 'Already friends') {
            res.status(400).json({ error: 'Already friends' });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getFriends = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const friends = await userService.getFriends(userId);
        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
