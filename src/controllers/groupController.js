const groupService = require('../services/groupService');

/**
 * Retrieves all groups relevant to the dashboard for the current user.
 * This includes groups created by the user and groups the user has joined (ordered).
 * Returns formatted data including aggregated order statistics.
 */
const getDashboardGroups = async (req, res) => {
    try {
        const userId = req.user.userId;
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
const createGroup = async (req, res) => {
    try {
        // Validation could be moved to middleware or distinct validation layer later
        const { title, startTime, endTime } = req.body;
        if (!title || !startTime || !endTime) {
            return res.status(400).json({ error: 'Title, start time, and end time are required' });
        }

        const userId = req.user.userId;
        const newGroup = await groupService.createGroup(userId, req.body);
        res.status(201).json(newGroup);
    } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ error: 'Failed to create group', details: error.message });
    }
};

/**
 * Updates an existing group.
 * Handles updating basic info, syncing product changes, and managing member invitations.
 */
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const updatedProducts = await groupService.updateGroup(userId, parseInt(id), req.body);

        res.json({
            message: 'Group updated successfully',
            products: updatedProducts
        });
    } catch (error) {
        console.error("Error updating group:", error);
        if (error.message === 'Group not found') return res.status(404).json({ error: 'Group not found' });
        if (error.message === 'Not authorized') return res.status(403).json({ error: 'Not authorized' });
        if (error.message.includes('Cannot delete item')) return res.status(400).json({ error: error.message });

        res.status(500).json({ error: 'Failed to update group' });
    }
};

/**
 * Deletes a group and all associated data (products, orders, items).
 * Prerequisite: All orders must be PAID or empty.
 */
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        await groupService.deleteGroup(userId, parseInt(id));

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error("Error deleting group:", error);
        if (error.message === 'Group not found') return res.status(404).json({ error: 'Group not found' });
        if (error.message === 'Not authorized') return res.status(403).json({ error: 'Not authorized' });
        if (error.message.includes('Cannot delete group')) return res.status(400).json({ error: error.message });

        res.status(500).json({ error: 'Failed to delete group', details: error.message });
    }
};

/**
 * Updates the status of a group (OPEN/CLOSED).
 */
const updateGroupStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;

        const updatedGroup = await groupService.updateGroupStatus(userId, parseInt(id), status);

        res.json({ message: 'Group status updated', group: updatedGroup });
    } catch (error) {
        console.error("Error updating group status:", error);
        if (error.message === 'Invalid status') return res.status(400).json({ error: 'Invalid status' });
        if (error.message === 'Group not found') return res.status(404).json({ error: 'Group not found' });
        if (error.message === 'Not authorized') return res.status(403).json({ error: 'Not authorized' });

        res.status(500).json({ error: 'Failed to update group status' });
    }
};

module.exports = {
    getDashboardGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    updateGroupStatus
};
