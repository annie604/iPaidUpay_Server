const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Service for Group management.
 */
class GroupService {
    /**
     * Retrieves all groups relevant to the dashboard for the current user.
     * @param {string} userId - The ID of the requesting user.
     * @returns {Promise<Array>} - Formatted list of groups.
     */
    async getDashboardGroups(userId) {
        // Fetch groups where user is creator OR has at least one order
        const groups = await prisma.group.findMany({
            where: {
                OR: [
                    { creatorId: userId },
                    { orders: { some: { userId: userId } } }
                ]
            },
            include: {
                creator: {
                    select: { id: true, name: true }
                },
                orders: {
                    include: {
                        user: { select: { id: true, name: true } },
                        items: true
                    }
                },
                products: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Format and Aggregate data
        return groups.map(g => {
            let totalGroupAmount = 0;
            const participantsSet = new Set();
            let myOrder = null;
            let invites = [];

            // Aggregation
            const statsMap = {};

            g.orders.forEach(o => {
                participantsSet.add(o.user.name);
                const orderSum = o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                totalGroupAmount += orderSum;

                if (o.userId === userId) {
                    myOrder = o;
                }

                // Collect participant info
                invites.push({ userId: o.userId, name: o.user.name });

                // Accumulate item stats
                o.items.forEach(item => {
                    if (!statsMap[item.name]) {
                        statsMap[item.name] = { name: item.name, quantity: 0, totalPrice: 0 };
                    }
                    statsMap[item.name].quantity += item.quantity;
                    statsMap[item.name].totalPrice += (item.quantity * item.price);
                });
            });

            let myItemsSummary = "";
            let myTotal = 0;

            if (myOrder) {
                myItemsSummary = myOrder.items.map(i => `${i.name}*${i.quantity}`).join(', ');
                myTotal = myOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            }

            return {
                id: g.id,
                title: g.title,
                startTime: g.startTime,
                endTime: g.endTime,
                status: g.status,
                creator: g.creator,
                participants: Array.from(participantsSet),
                invites: invites,
                products: g.products,
                totalGroupAmount: totalGroupAmount,
                orderStats: Object.values(statsMap),
                myOrder: myOrder ? {
                    id: myOrder.id,
                    itemsSummary: myItemsSummary,
                    total: myTotal,
                    items: myOrder.items,
                    paymentStatus: myOrder.paymentStatus,
                    updatedAt: myOrder.updatedAt
                } : null,
                isCreator: g.creatorId === userId
            };
        });
    }

    /**
     * Creates a new group.
     * @param {string} userId - Creator's ID.
     * @param {Object} data - Group data (title, startTime, endTime, products, invitedUserIds, initialOrder).
     * @returns {Promise<Object>} - The created group.
     */
    async createGroup(userId, data) {
        const { title, startTime, endTime, products, invitedUserIds, initialOrder } = data;

        return await prisma.group.create({
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                creatorId: userId,
                status: 'OPEN',
                products: {
                    create: products // Expects array of { name, price }
                },
                orders: {
                    create: [
                        {
                            userId: userId,
                            paymentStatus: 'PAID', // Creator defaults to PAID
                            items: initialOrder && initialOrder.length > 0 ? {
                                create: initialOrder.map(io => ({
                                    name: io.name,
                                    price: Number(io.price),
                                    quantity: Number(io.quantity)
                                }))
                            } : undefined
                        },
                        // Create empty orders for invited friends
                        ...(invitedUserIds || []).map(invitedId => ({
                            userId: invitedId
                        }))
                    ]
                }
            },
            include: {
                products: true,
                orders: true
            }
        });
    }

    /**
     * Updates an existing group.
     * @param {string} userId - Requesting user ID.
     * @param {string} groupId - Group ID.
     * @param {Object} data - Update data (title, dates, products, invitedUserIds).
     * @returns {Promise<Object>} - Result message and updated products.
     */
    async updateGroup(userId, groupId, data) {
        const { title, startTime, endTime, products, invitedUserIds } = data;

        // Verify group existence and ownership
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { orders: true }
        });

        if (!group) throw new Error('Group not found');
        if (group.creatorId !== userId) throw new Error('Not authorized');

        // Update basic details
        await prisma.group.update({
            where: { id: groupId },
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            }
        });

        // --- Member Sync ---
        const existingUserIds = group.orders.map(o => o.userId);
        const targetUserIds = new Set(invitedUserIds || []);
        targetUserIds.add(userId);

        // Add missing
        const toAdd = [...targetUserIds].filter(uid => !existingUserIds.includes(uid));
        if (toAdd.length > 0) {
            await prisma.groupOrder.createMany({
                data: toAdd.map(uid => ({
                    userId: uid,
                    groupId: groupId
                }))
            });
        }

        // Remove uninvited
        const toRemove = existingUserIds.filter(uid => !targetUserIds.has(uid) && uid !== userId);
        if (toRemove.length > 0) {
            const ordersToDelete = await prisma.groupOrder.findMany({
                where: {
                    groupId: groupId,
                    userId: { in: toRemove }
                },
                select: { id: true }
            });
            const orderIds = ordersToDelete.map(o => o.id);

            if (orderIds.length > 0) {
                await prisma.userOrder.deleteMany({ where: { groupOrderId: { in: orderIds } } });
                await prisma.groupOrder.deleteMany({ where: { id: { in: orderIds } } });
            }
        }

        // --- Product Sync ---
        if (products && Array.isArray(products)) {
            const updates = products.filter(p => p.id).map(p =>
                prisma.groupMenu.update({
                    where: { id: p.id },
                    data: { name: p.name, price: p.price }
                })
            );

            const creates = products.filter(p => !p.id).map(p =>
                prisma.groupMenu.create({
                    data: { name: p.name, price: p.price, groupId: groupId }
                })
            );

            const keepIds = products.filter(p => p.id).map(p => p.id);
            const productsToDelete = await prisma.groupMenu.findMany({
                where: { groupId: groupId, id: { notIn: keepIds } }
            });

            if (productsToDelete.length > 0) {
                const namesToDelete = productsToDelete.map(p => p.name);
                const idsToDelete = productsToDelete.map(p => p.id);

                // Check usage by ID or Name (for legacy data)
                const usedItem = await prisma.userOrder.findFirst({
                    where: {
                        order: { groupId: groupId },
                        OR: [
                            { menuId: { in: idsToDelete } },
                            { name: { in: namesToDelete } }
                        ]
                    }
                });

                if (usedItem) {
                    throw new Error(`Cannot delete item "${usedItem.name}" because it has been ordered by a member.`);
                }

                const deleteOp = prisma.groupMenu.deleteMany({
                    where: { id: { in: productsToDelete.map(p => p.id) } }
                });

                await prisma.$transaction([...updates, ...creates, deleteOp]);
            } else {
                // Sync name/price updates to OrderItems
                // STRATEGY: 
                // 1. Update OrderItems linked by productId (Reliable)
                // 2. Update OrderItems linked by Name (Legacy fallback)

                const syncOps = [];
                const existingProducts = await prisma.groupMenu.findMany({ where: { groupId } });

                for (const newProd of products) {
                    if (newProd.id) {
                        const oldProd = existingProducts.find(p => p.id === newProd.id);
                        if (oldProd && (oldProd.name !== newProd.name || oldProd.price !== newProd.price)) {
                            // Sync by ID (New Standard)
                            syncOps.push(
                                prisma.userOrder.updateMany({
                                    where: { menuId: newProd.id },
                                    data: { name: newProd.name, price: newProd.price }
                                })
                            );

                            // Sync by Name (Legacy Support - only if productId is null)
                            syncOps.push(
                                prisma.userOrder.updateMany({
                                    where: {
                                        order: { groupId: groupId },
                                        name: oldProd.name,
                                        menuId: null
                                    },
                                    data: { name: newProd.name, price: newProd.price, menuId: newProd.id }
                                    // Also auto-link legacy items to the product ID now!
                                })
                            );
                        }
                    }
                }
                await prisma.$transaction([...updates, ...creates, ...syncOps]);
            }
        }

        return await prisma.groupMenu.findMany({ where: { groupId } });
    }

    /**
     * Deletes a group.
     * @param {string} userId 
     * @param {string} groupId 
     */
    async deleteGroup(userId, groupId) {
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error('Group not found');
        if (group.creatorId !== userId) throw new Error('Not authorized');

        const unpaidOrders = await prisma.groupOrder.findFirst({
            where: { groupId, paymentStatus: 'UNPAID' }
        });
        if (unpaidOrders) throw new Error('Cannot delete group: Some members have not paid.');

        const groupOrders = await prisma.groupOrder.findMany({ where: { groupId }, select: { id: true } });
        const orderIds = groupOrders.map(o => o.id);

        await prisma.$transaction([
            prisma.userOrder.deleteMany({ where: { groupOrderId: { in: orderIds } } }),
            prisma.groupOrder.deleteMany({ where: { groupId } }),
            prisma.groupMenu.deleteMany({ where: { groupId } }),
            prisma.group.delete({ where: { id: groupId } })
        ]);
    }

    /**
     * Updates group status.
     * @param {string} userId 
     * @param {string} groupId 
     * @param {string} status 
     */
    async updateGroupStatus(userId, groupId, status) {
        if (!['OPEN', 'CLOSED'].includes(status)) throw new Error('Invalid status');

        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error('Group not found');
        if (group.creatorId !== userId) throw new Error('Not authorized');

        return await prisma.group.update({
            where: { id: groupId },
            data: { status }
        });
    }
}

module.exports = new GroupService();
