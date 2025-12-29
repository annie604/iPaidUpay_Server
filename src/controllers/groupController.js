const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Retrieves all groups relevant to the dashboard for the current user.
 * This includes groups created by the user and groups the user has joined (ordered).
 * Returns formatted data including aggregated order statistics.
 */
const getDashboardGroups = async (req, res) => {
    try {
        const userId = req.user.userId;

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

        const formatted = groups.map(g => {
            let totalGroupAmount = 0;
            const participantsSet = new Set();
            let myOrder = null;
            let invites = [];

            // Aggregation: Calculate total quantity and price per product
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

        res.json(formatted);
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
        const { title, startTime, endTime, products, invitedUserIds, initialOrder } = req.body;
        const userId = req.user.userId;

        if (!title || !startTime || !endTime) {
            return res.status(400).json({ error: 'Title, start time, and end time are required' });
        }

        // Create group, active products, and initial orders for all participants
        const newGroup = await prisma.group.create({
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
                        // Create empty orders for invited friends to add them to participants list
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
        const { title, startTime, endTime, products, invitedUserIds } = req.body;
        const userId = req.user.userId;

        // Verify group existence and ownership
        const group = await prisma.group.findUnique({
            where: { id: parseInt(id) },
            include: { orders: true }
        });

        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

        // Update basic group details
        await prisma.group.update({
            where: { id: parseInt(id) },
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            }
        });

        // --- Member Synchronization ---
        // Determine which members to add or remove based on invitedUserIds
        const existingUserIds = group.orders.map(o => o.userId);
        const targetUserIds = new Set(invitedUserIds || []);
        targetUserIds.add(userId); // Creator must remain

        // Add new members
        const toAdd = [...targetUserIds].filter(uid => !existingUserIds.includes(uid));
        if (toAdd.length > 0) {
            await prisma.order.createMany({
                data: toAdd.map(uid => ({
                    userId: uid,
                    groupId: parseInt(id)
                }))
            });
        }

        // Remove members who were uninvited (and their orders)
        const toRemove = existingUserIds.filter(uid => !targetUserIds.has(uid) && uid !== userId);
        if (toRemove.length > 0) {
            const ordersToDelete = await prisma.order.findMany({
                where: {
                    groupId: parseInt(id),
                    userId: { in: toRemove }
                },
                select: { id: true }
            });

            const orderIds = ordersToDelete.map(o => o.id);

            if (orderIds.length > 0) {
                // Manual cascade: Delete items then orders
                await prisma.orderItem.deleteMany({
                    where: { orderId: { in: orderIds } }
                });

                await prisma.order.deleteMany({
                    where: { id: { in: orderIds } }
                });
            }
        }

        // --- Product Synchronization ---
        if (products && Array.isArray(products)) {
            // Update existing products
            const updates = products.filter(p => p.id).map(p =>
                prisma.groupProduct.update({
                    where: { id: p.id },
                    data: { name: p.name, price: p.price }
                })
            );

            // Create new products
            const creates = products.filter(p => !p.id).map(p =>
                prisma.groupProduct.create({
                    data: {
                        name: p.name,
                        price: p.price,
                        groupId: parseInt(id)
                    }
                })
            );

            // Identify products to delete
            const keepIds = products.filter(p => p.id).map(p => p.id);
            const productsToDelete = await prisma.groupProduct.findMany({
                where: {
                    groupId: parseInt(id),
                    id: { notIn: keepIds }
                }
            });

            if (productsToDelete.length > 0) {
                const namesToDelete = productsToDelete.map(p => p.name);

                // Prevent deletion if items are used in any order
                const usedItem = await prisma.orderItem.findFirst({
                    where: {
                        order: { groupId: parseInt(id) },
                        name: { in: namesToDelete }
                    }
                });

                if (usedItem) {
                    return res.status(400).json({
                        error: `Cannot delete item "${usedItem.name}" because it has been ordered by a member.`
                    });
                }

                // Safe to delete unused products
                const deleteOp = prisma.groupProduct.deleteMany({
                    where: { id: { in: productsToDelete.map(p => p.id) } }
                });

                await prisma.$transaction([...updates, ...creates, deleteOp]);

            } else {
                // No deletions, handle updates including name/price sync to order items
                const existingProducts = await prisma.groupProduct.findMany({
                    where: { groupId: parseInt(id) }
                });

                const syncOps = [];

                for (const newProd of products) {
                    if (newProd.id) {
                        const oldProd = existingProducts.find(p => p.id === newProd.id);
                        if (oldProd) {
                            if (oldProd.name !== newProd.name || oldProd.price !== newProd.price) {
                                // Sync product changes to existing order items (snapshot update)
                                syncOps.push(
                                    prisma.orderItem.updateMany({
                                        where: {
                                            order: { groupId: parseInt(id) },
                                            name: oldProd.name
                                        },
                                        data: {
                                            name: newProd.name,
                                            price: newProd.price
                                        }
                                    })
                                );
                            }
                        }
                    }
                }

                await prisma.$transaction([...updates, ...creates, ...syncOps]);
            }
        }

        const updatedProducts = await prisma.groupProduct.findMany({
            where: { groupId: parseInt(id) }
        });

        res.json({
            message: 'Group updated successfully',
            products: updatedProducts
        });
    } catch (error) {
        console.error("Error updating group:", error);
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

        const group = await prisma.group.findUnique({ where: { id: parseInt(id) } });

        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

        // Check for unpaid orders before allowing deletion
        const unpaidOrders = await prisma.order.findFirst({
            where: {
                groupId: parseInt(id),
                paymentStatus: 'UNPAID'
            }
        });

        if (unpaidOrders) {
            return res.status(400).json({ error: 'Cannot delete group: Some members have not paid.' });
        }

        // Perform transactional cascade delete
        const groupOrders = await prisma.order.findMany({
            where: { groupId: parseInt(id) },
            select: { id: true }
        });
        const orderIds = groupOrders.map(o => o.id);

        await prisma.$transaction([
            prisma.orderItem.deleteMany({
                where: { orderId: { in: orderIds } }
            }),
            prisma.order.deleteMany({
                where: { groupId: parseInt(id) }
            }),
            prisma.groupProduct.deleteMany({
                where: { groupId: parseInt(id) }
            }),
            prisma.group.delete({
                where: { id: parseInt(id) }
            })
        ]);

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error("Error deleting group:", error);
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

        if (!status || !['OPEN', 'CLOSED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const group = await prisma.group.findUnique({ where: { id: parseInt(id) } });

        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

        const updatedGroup = await prisma.group.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        res.json({ message: 'Group status updated', group: updatedGroup });
    } catch (error) {
        console.error("Error updating group status:", error);
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
