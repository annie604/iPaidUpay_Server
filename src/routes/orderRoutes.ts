import express from 'express';
import * as orderController from '../controllers/orderController';
import authenticateToken from '../middleware/authMiddleware';

const router = express.Router();

// Update order for a group (Create/Update logic)
// POST because we are "submitting" an order form, logically implies updating the User's single order tuple for this group.
router.post('/', authenticateToken, orderController.updateOrder);

// Get group summary with all orders and statistics
router.get('/group/:groupId/summary', authenticateToken, orderController.getGroupSummary);

// Update payment status (Creator only)
router.put('/:orderId/payment-status', authenticateToken, orderController.updatePaymentStatus);

export default router;
