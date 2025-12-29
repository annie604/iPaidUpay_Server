import { Request, Response } from 'express';
import orderService from '../services/orderService';
import { AuthRequest } from '../middleware/authMiddleware';

export const updateOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { groupId, items } = req.body;

        const result = await orderService.updateOrder(userId, parseInt(groupId), items);

        res.json({
            message: 'Order updated successfully',
            order: result
        });

    } catch (error: any) {
        console.error("Error updating order:", error);
        if (error.message.includes('Group is closed')) {
            res.status(400).json({ error: error.message });
            return;
        }
        if (error.message === 'Access denied to this group') {
            res.status(403).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: 'Failed to update order' });
    }
};

// Get group summary with all orders and statistics
export const getGroupSummary = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { groupId } = req.params;

        const summary = await orderService.getGroupSummary(userId, parseInt(groupId));

        res.json(summary);

    } catch (error: any) {
        console.error("Error fetching group summary:", error);
        if (error.message === 'Access denied to this group') {
            res.status(403).json({ error: error.message });
            return;
        }

        res.status(500).json({ error: 'Failed to fetch group summary' });
    }
};

// Update payment status (Creator Only)
export const updatePaymentStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { orderId } = req.params;
        const { status } = req.body;

        const result = await orderService.updatePaymentStatus(userId, parseInt(orderId), status);

        res.json({
            message: 'Payment status updated',
            paymentStatus: result.paymentStatus
        });

    } catch (error: any) {
        console.error("Error updating payment status:", error);
        if (error.message.includes('Invalid status')) {
            res.status(400).json({ error: error.message });
            return;
        }
        if (error.message === 'Order not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        if (error.message === 'Not authorized') {
            res.status(403).json({ error: 'Only group creator can update payment status' });
            return;
        }

        res.status(500).json({ error: 'Failed to update payment status' });
    }
};
