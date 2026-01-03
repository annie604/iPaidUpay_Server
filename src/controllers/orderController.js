const orderService = require('../services/orderService');

const updateOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId, items } = req.body;

        const result = await orderService.updateOrder(userId, groupId, items);

        res.json({
            message: 'Order updated successfully',
            order: result
        });

    } catch (error) {
        console.error("Error updating order:", error);
        if (error.message.includes('Group is closed')) return res.status(400).json({ error: error.message });
        if (error.message === 'Access denied to this group') return res.status(403).json({ error: error.message });

        res.status(500).json({ error: 'Failed to update order' });
    }
};

// Get group summary with all orders and statistics
const getGroupSummary = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        const summary = await orderService.getGroupSummary(userId, groupId);

        res.json(summary);

    } catch (error) {
        console.error("Error fetching group summary:", error);
        if (error.message === 'Access denied to this group') return res.status(403).json({ error: error.message });

        res.status(500).json({ error: 'Failed to fetch group summary' });
    }
};

// Update payment status (Creator Only)
const updatePaymentStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { orderId } = req.params;
        const { status } = req.body;

        const result = await orderService.updatePaymentStatus(userId, orderId, status);

        res.json({
            message: 'Payment status updated',
            paymentStatus: result.paymentStatus
        });

    } catch (error) {
        console.error("Error updating payment status:", error);
        if (error.message.includes('Invalid status')) return res.status(400).json({ error: error.message });
        if (error.message === 'Order not found') return res.status(404).json({ error: error.message });
        if (error.message === 'Not authorized') return res.status(403).json({ error: 'Only group creator can update payment status' });

        res.status(500).json({ error: 'Failed to update payment status' });
    }
};

module.exports = {
    updateOrder,
    getGroupSummary,
    updatePaymentStatus
};
