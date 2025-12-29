import { Request, Response } from 'express';
import groupService from '../services/groupService';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Retrieves all groups relevant to the dashboard for the current user.
 * This includes groups created by the user and groups the user has joined (ordered).
 * Returns formatted data including aggregated order statistics.
 */
export const getDashboardGroups = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const groups = await groupService.getDashboardGroups(userId);
        res.json(groups);
    } catch (error) {
        console.error("Error fetching dashboard groups:", error);
        res.status(500).json({ error: "Failed to fetch groups" });
    }
};

/**
 * Creates a new group with specified products and invited members.
 * Also creates an initial order for the creator if specified.
 */
export const createGroup = async (req: Request, res: Response) => {
    try {
        // Validation could be moved to middleware or distinct validation layer later
        const { title, startTime, endTime } = req.body;
        if (!title || !startTime || !endTime) {
            res.status(400).json({ error: 'Title, start time, and end time are required' });
            return;
        }

        const userId = (req as AuthRequest).user!.userId;
        const newGroup = await groupService.createGroup(userId, req.body);
        res.status(201).json(newGroup);
    } catch (error: any) {
        console.error("Error creating group:", error);
        res.status(500).json({ error: 'Failed to create group', details: error.message });
    }
};

/**
 * Updates an existing group.
 * Handles updating basic info, syncing product changes, and managing member invitations.
 */
export const updateGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as AuthRequest).user!.userId;

        const updatedProducts = await groupService.updateGroup(userId, parseInt(id), req.body);

        res.json({
            message: 'Group updated successfully',
            products: updatedProducts
        });
    } catch (error: any) {
        console.error("Error updating group:", error);
        if (error.message === 'Group not found') {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        if (error.message === 'Not authorized') {
            res.status(403).json({ error: 'Not authorized' });
            return;
        }
        if (error.message.includes('Cannot delete item')) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: 'Failed to update group' });
    }
};

/**
 * Deletes a group and all associated data (products, orders, items).
 * Prerequisite: All orders must be PAID or empty.
 */
export const deleteGroup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as AuthRequest).user!.userId;

        await groupService.deleteGroup(userId, parseInt(id));

        res.json({ message: 'Group deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting group:", error);
        if (error.message === 'Group not found') {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        if (error.message === 'Not authorized') {
            res.status(403).json({ error: 'Not authorized' });
            return;
        }
        if (error.message.includes('Cannot delete group')) {
            res.status(400).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: 'Failed to delete group', details: error.message });
    }
};

/**
 * Updates the status of a group (OPEN/CLOSED).
 */
export const updateGroupStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = (req as AuthRequest).user!.userId;

        const updatedGroup = await groupService.updateGroupStatus(userId, parseInt(id), status);

        res.json({ message: 'Group status updated', group: updatedGroup });
    } catch (error: any) {
        console.error("Error updating group status:", error);
        if (error.message === 'Invalid status') {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        if (error.message === 'Group not found') {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        if (error.message === 'Not authorized') {
            res.status(403).json({ error: 'Not authorized' });
            return;
        }

        res.status(500).json({ error: 'Failed to update group status' });
    }
};
