const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateOrder = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId, items } = req.body;

        if (!groupId) {
            return res.status(400).json({ error: 'Group ID is required' });
        }

        // Validate that the group exists and user has access
        const group = await prisma.group.findFirst({
            where: {
                id: parseInt(groupId),
                OR: [
                    { creatorId: userId },
                    { orders: { some: { userId: userId } } }
                ]
            }
        });

        if (!group) {
            return res.status(403).json({ error: 'Access denied to this group' });
        }

        // 1. Find or Create the Order for this User + Group
        let order = await prisma.order.findFirst({
            where: {
                userId: userId,
                groupId: parseInt(groupId)
            }
        });

        if (!order) {
            order = await prisma.order.create({
                data: {
                    userId: userId,
                    groupId: parseInt(groupId)
                }
            });
        }

        // 2. Update Items (Transaction: Delete old items -> Create new items)
        const orderId = order.id;

        await prisma.$transaction(async (tx) => {
            // Delete existing items for this order
            await tx.orderItem.deleteMany({
                where: { orderId: orderId }
            });

            // Create new items
            if (items && items.length > 0) {
                await tx.orderItem.createMany({
                    data: items.map(item => ({
                        orderId: orderId,
                        name: item.name,
                        price: Number(item.price),
                        quantity: Number(item.quantity)
                    }))
                });
            }

            // Update the order's updatedAt timestamp
            await tx.order.update({
                where: { id: orderId },
                data: { updatedAt: new Date() }
            });
        });

        // 3. Return updated order with items
        const updatedOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        // Calculate total for response convenience
        const total = updatedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemsSummary = updatedOrder.items.map(i => `${i.name}*${i.quantity}`).join(', ');

        res.json({
            message: 'Order updated successfully',
            order: {
                id: updatedOrder.id,
                items: updatedOrder.items,
                total,
                itemsSummary,
                updatedAt: updatedOrder.updatedAt
            }
        });

    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ error: 'Failed to update order' });
    }
};

// Get group summary with all orders and statistics
const getGroupSummary = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { groupId } = req.params;

        // Validate access to group
        const group = await prisma.group.findFirst({
            where: {
                id: parseInt(groupId),
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

        if (!group) {
            return res.status(403).json({ error: 'Access denied to this group' });
        }

        // Calculate statistics
        let totalGroupAmount = 0;
        const participantsSet = new Set();
        const statsMap = {}; // name -> { quantity, totalPrice }

        group.orders.forEach(order => {
            participantsSet.add(order.user.name);
            const orderSum = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            totalGroupAmount += orderSum;

            // Aggregate items for summary
            order.items.forEach(item => {
                if (!statsMap[item.name]) {
                    statsMap[item.name] = { name: item.name, quantity: 0, totalPrice: 0 };
                }
                statsMap[item.name].quantity += item.quantity;
                statsMap[item.name].totalPrice += (item.quantity * item.price);
            });
        });

        // Find user's order
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

        res.json({
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
                user: order.user,
                items: order.items,
                total: order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                paymentStatus: order.paymentStatus,
                updatedAt: order.updatedAt
            }))
        });

    } catch (error) {
        console.error("Error fetching group summary:", error);
        res.status(500).json({ error: 'Failed to fetch group summary' });
    }
};

module.exports = {
    updateOrder,
    getGroupSummary
};
