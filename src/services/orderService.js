const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Service for Order management.
 */
class OrderService {

    /**
     * Updates (or creates) an order for a user in a group.
     * @param {number} userId 
     * @param {number} groupId 
     * @param {Array} items - Array of { name, price, quantity }
     * @returns {Promise<Object>} - Updated order details.
     */
    async updateOrder(userId, groupId, items) {
        if (!groupId) throw new Error('Group ID is required');

        // Validation
        const group = await prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { creatorId: userId },
                    { orders: { some: { userId: userId } } }
                ]
            }
        });

        if (!group) throw new Error('Access denied to this group');
        if (group.status === 'CLOSED') throw new Error('Group is closed. Cannot update order.');

        // Find or Create Order
        let order = await prisma.order.findFirst({
            where: { userId, groupId }
        });

        if (!order) {
            order = await prisma.order.create({
                data: { userId, groupId }
            });
        }

        const orderId = order.id;

        // Transactional Update
        await prisma.$transaction(async (tx) => {
            await tx.orderItem.deleteMany({ where: { orderId } });

            if (items && items.length > 0) {
                await tx.orderItem.createMany({
                    data: items.map(item => ({
                        orderId,
                        name: item.name,
                        price: Number(item.price),
                        quantity: Number(item.quantity)
                    }))
                });
            }

            await tx.order.update({
                where: { id: orderId },
                data: { updatedAt: new Date() }
            });
        });

        // Fetch updated
        const updatedOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        // Format
        const total = updatedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemsSummary = updatedOrder.items.map(i => `${i.name}*${i.quantity}`).join(', ');

        return {
            id: updatedOrder.id,
            items: updatedOrder.items,
            total,
            itemsSummary,
            updatedAt: updatedOrder.updatedAt
        };
    }

    /**
     * Retrieves detailed group summary.
     * @param {number} userId 
     * @param {number} groupId 
     * @returns {Promise<Object>}
     */
    async getGroupSummary(userId, groupId) {
        const group = await prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { creatorId: userId },
                    { orders: { some: { userId: userId } } }
                ]
            },
            include: {
                creator: { select: { id: true, name: true } },
                orders: {
                    include: {
                        user: { select: { id: true, name: true } },
                        items: true
                    }
                },
                products: true
            }
        });

        if (!group) throw new Error('Access denied to this group');

        // Stats Calculation
        let totalGroupAmount = 0;
        const participantsSet = new Set();
        const statsMap = {};

        group.orders.forEach(order => {
            participantsSet.add(order.user.name);
            const orderSum = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            totalGroupAmount += orderSum;

            order.items.forEach(item => {
                if (!statsMap[item.name]) {
                    statsMap[item.name] = { name: item.name, quantity: 0, totalPrice: 0 };
                }
                statsMap[item.name].quantity += item.quantity;
                statsMap[item.name].totalPrice += (item.quantity * item.price);
            });
        });

        // User's own order
        const myOrder = group.orders.find(order => order.userId === userId);
        let myOrderData = null;
        if (myOrder) {
            const myTotal = myOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const myItemsSummary = myOrder.items.map(i => `${i.name}*${i.quantity}`).join(', ');

            myOrderData = {
                id: myOrder.id,
                items: myOrder.items,
                total: myTotal,
                itemsSummary: myItemsSummary,
                paymentStatus: myOrder.paymentStatus,
                updatedAt: myOrder.updatedAt
            };
        }

        return {
            id: group.id,
            title: group.title,
            startTime: group.startTime,
            endTime: group.endTime,
            status: group.status,
            creator: group.creator,
            products: group.products,
            participants: Array.from(participantsSet),
            totalGroupAmount,
            orderStats: Object.values(statsMap),
            myOrder: myOrderData,
            isCreator: group.creatorId === userId,
            allOrders: group.orders.map(order => ({
                id: order.id,
                userId: order.userId, // Include user ID
                user: order.user,
                items: order.items,
                total: order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                paymentStatus: order.paymentStatus,
                updatedAt: order.updatedAt
            }))
        };
    }

    /**
     * Updates payment status of an order.
     * @param {number} userId - Requesting user (must be creator)
     * @param {number} orderId 
     * @param {string} status 
     * @returns {Promise<Object>}
     */
    async updatePaymentStatus(userId, orderId, status) {
        if (!['PAID', 'UNPAID'].includes(status)) {
            throw new Error('Invalid status. Must be PAID or UNPAID.');
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { group: true }
        });

        if (!order) throw new Error('Order not found');
        if (order.group.creatorId !== userId) throw new Error('Not authorized');

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: status }
        });

        return { paymentStatus: updatedOrder.paymentStatus };
    }
}

module.exports = new OrderService();
