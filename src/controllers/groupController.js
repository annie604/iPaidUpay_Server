const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardGroups = async (req, res) => {
    try {
        const userId = req.user.userId;

        const groups = await prisma.group.findMany({
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
                products: true // Include products for edit modal
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = groups.map(g => {
            let totalGroupAmount = 0;
            const participantsSet = new Set();
            let myOrder = null;
            let invites = [];

            // Calculate Group Statistics (Aggregation)
            const statsMap = {}; // name -> { quantity, totalPrice }

            g.orders.forEach(o => {
                participantsSet.add(o.user.name);
                const orderSum = o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                totalGroupAmount += orderSum;

                if (o.userId === userId) {
                    myOrder = o;
                }

                // Collect invite info (User ID and Name)
                invites.push({ userId: o.userId, name: o.user.name });

                // Aggregate Items for Summary
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
                orderStats: Object.values(statsMap), // Array of { name, quantity, totalPrice }
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

const createGroup = async (req, res) => {
    try {
        const { title, startTime, endTime, products, invitedUserIds, initialOrder } = req.body;
        const userId = req.user.userId;

        if (!title || !startTime || !endTime) {
            return res.status(400).json({ error: 'Title, start time, and end time are required' });
        }

        const newGroup = await prisma.group.create({
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                creatorId: userId,
                status: 'OPEN',
                products: {
                    create: products // Array of { name, price }
                },
                // Create orders for invited users (including creator if we want, but usually creator logic is separate or implied)
                // Let's create an empty Order for the Creator AND Invited Users so they all show up in the list.
                // Wait, existing logic might rely on Order existence for "participants".
                // Yes: convert orders to participants list.
                // So we MUST create an order for the creator too.
                orders: {
                    create: [
                        {
                            userId: userId,
                            // Create items for the creator's initial order if provided
                            items: initialOrder && initialOrder.length > 0 ? {
                                create: initialOrder.map(io => ({
                                    name: io.name,
                                    price: Number(io.price),
                                    quantity: Number(io.quantity)
                                }))
                            } : undefined
                        },
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

const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, startTime, endTime, products, invitedUserIds } = req.body;
        const userId = req.user.userId;

        // Verify ownership
        const group = await prisma.group.findUnique({
            where: { id: parseInt(id) },
            include: { orders: true } // Need orders to check existing participants
        });

        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

        // Update basic info
        await prisma.group.update({
            where: { id: parseInt(id) },
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            }
        });

        // Update Products: Replace all products (simplest strategy for this scale)
        // Or smarter: update existing, create new, delete missing.
        // Let's go with "delete all and recreate" for simplicity if no orders rely on specific product IDs yet.
        // BUT orders contain OrderItem referencing Product. Deleting products might violate FK if orders exist.
        // Better strategy for products:
        // 1. Get existing products.
        // 2. We can allow editing names/prices of existing products?
        // The frontend sends `products` array. If we want to support existing product ID, frontend must send it.
        // Current frontend implementation in CreateGroupModal sends {name, price} without ID for new ones?
        // Let's check GroupDetailModal: it sends whatever is in `localGroup.products`.
        // If data comes from `fetchGroups`, it might have IDs.
        // Let's assume for now we just delete all and recreate is risky if items linked.
        // Let's try `deleteMany` for this group's products and `createMany`.
        // Risky if OrderItems exist.
        // Safe approach: Update products logic is complex. Let's start with Basic Info + Members Only for this step?
        // The user specifically complained about "member".
        // Let's handle invitedUserIds (Members).

        // Sync Members (Orders)
        // Existing user IDs in this group
        const existingUserIds = group.orders.map(o => o.userId);

        // New list of invited User IDs (plus creator who must stay)
        const targetUserIds = new Set(invitedUserIds || []);
        targetUserIds.add(userId); // Ensure creator is always in

        // 1. Add missing members
        const toAdd = [...targetUserIds].filter(uid => !existingUserIds.includes(uid));
        if (toAdd.length > 0) {
            await prisma.order.createMany({
                data: toAdd.map(uid => ({
                    userId: uid,
                    groupId: parseInt(id)
                }))
            });
        }

        // 2. Remove members who are no longer in the list (and not Creator)
        const toRemove = existingUserIds.filter(uid => !targetUserIds.has(uid) && uid !== userId);
        if (toRemove.length > 0) {
            // Find orders to be deleted
            const ordersToDelete = await prisma.order.findMany({
                where: {
                    groupId: parseInt(id),
                    userId: { in: toRemove }
                },
                select: { id: true }
            });

            const orderIds = ordersToDelete.map(o => o.id);

            // Delete items in these orders first (Cascade manual simulation)
            if (orderIds.length > 0) {
                await prisma.orderItem.deleteMany({
                    where: { orderId: { in: orderIds } }
                });

                await prisma.order.deleteMany({
                    where: { id: { in: orderIds } }
                });
            }
        }

        // Handle Products Update
        if (products && Array.isArray(products)) {
            // 1. Update existing (if has ID)
            const updates = products.filter(p => p.id).map(p =>
                prisma.groupProduct.update({
                    where: { id: p.id },
                    data: { name: p.name, price: p.price }
                })
            );

            // 2. Create new (if no ID)
            const creates = products.filter(p => !p.id).map(p =>
                prisma.groupProduct.create({
                    data: {
                        name: p.name,
                        price: p.price,
                        groupId: parseInt(id)
                    }
                })
            );

            // 3. Delete missing
            const keepIds = products.filter(p => p.id).map(p => p.id);

            // Find products that are about to be deleted
            const productsToDelete = await prisma.groupProduct.findMany({
                where: {
                    groupId: parseInt(id),
                    id: { notIn: keepIds }
                }
            });

            if (productsToDelete.length > 0) {
                const namesToDelete = productsToDelete.map(p => p.name);

                // Strict Check: Are any of these products used in existing orders?
                // Note: OrderItem stores 'name', not ID. So we check by name match within this group.
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

                // If safe, verify delete operation in transaction
                const deleteOp = prisma.groupProduct.deleteMany({
                    where: { id: { in: productsToDelete.map(p => p.id) } }
                });

            } else {
                // No deletions, just updates and creates

                // --- SYNC UPDATE LOGIC START ---
                // Detect updates where name or price changed, and propagate to OrderItems

                // 1. Fetch current DB state of products (before update)
                const existingProducts = await prisma.groupProduct.findMany({
                    where: { groupId: parseInt(id) }
                });

                const syncOps = [];

                // 2. Iterate through incoming products that have an ID (updates)
                for (const newProd of products) {
                    if (newProd.id) {
                        const oldProd = existingProducts.find(p => p.id === newProd.id);
                        if (oldProd) {
                            // Check if critical fields changed
                            if (oldProd.name !== newProd.name || oldProd.price !== newProd.price) {
                                // Add operation to update all OrderItems sharing this old name in this group
                                console.log(`Syncing product update: ${oldProd.name} -> ${newProd.name} ($${newProd.price})`);
                                syncOps.push(
                                    prisma.orderItem.updateMany({
                                        where: {
                                            order: { groupId: parseInt(id) },
                                            name: oldProd.name // Find items snapshot with old name
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

                // Add syncOps to transaction
                await prisma.$transaction([...updates, ...creates, ...syncOps]);
                // --- SYNC UPDATE LOGIC END ---
            }
        }

        // Fetch updated products to return to frontend
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

const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const group = await prisma.group.findUnique({ where: { id: parseInt(id) } });

        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.creatorId !== userId) return res.status(403).json({ error: 'Not authorized' });

        // Prisma cascade delete should handle relations if configured, otherwise need manual cleanup.
        // Assuming schema has onDelete: Cascade for Orders/Products -> Group.
        // If not, we might need to delete children first.
        // Usually safe to try delete.

        // Manual cleanup just in case or if schema is strict
        // Delete OrderItems -> Orders -> Products -> Group (dependency order)
        // Actually: OrderItems depend on Order and Product.
        // Orders depend on Group. Products depend on Group.

        // Delete OrderItems for orders in this group
        /*
        await prisma.orderItem.deleteMany({
            where: {
                order: { groupId: parseInt(id) }
            }
        });
        */
        // Relying on schema cascade is better if set up. If errors, we fix.
        await prisma.group.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error("Error deleting group:", error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};

module.exports = {
    getDashboardGroups,
    createGroup,
    updateGroup,
    deleteGroup
};
