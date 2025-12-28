const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateToken = require('../middleware/authMiddleware');

// Update order for a group (Create/Update logic)
// POST because we are "submitting" an order form, logically implies updating the User's single order tuple for this group.
router.post('/', authenticateToken, orderController.updateOrder);

// Get group summary with all orders and statistics
router.get('/group/:groupId/summary', authenticateToken, orderController.getGroupSummary);

// Update payment status (Creator only)
router.put('/:orderId/payment-status', authenticateToken, orderController.updatePaymentStatus);

module.exports = router;
