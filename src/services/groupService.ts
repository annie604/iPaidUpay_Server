import { PrismaClient, Group, GroupProduct, Order, OrderItem } from '@prisma/client';

const prisma = new PrismaClient();

interface GroupData {
    title: string;
    startTime: string | Date;
    endTime: string | Date;
    products: { id?: number; name: string; price: number }[];
    invitedUserIds?: number[];
    initialOrder?: { name: string; price: number; quantity: number }[];
}

/**
 * Service for Group management.
 */
class GroupService {
    /**
     * Retrieves all groups relevant to the dashboard for the current user.
     * @param userId - The ID of the requesting user.
     * @returns Formatted list of groups.
     */
    async getDashboardGroups(userId: number) {
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
            const participantsSet = new Set<string | null>();
            let myOrder = null;
            let invites: { userId: number; name: string | null }[] = [];

            // Aggregation
            const statsMap: Record<string, { name: string; quantity: number; totalPrice: number }> = {};

            g.orders.forEach(o => {
                participantsSet.add(o.user.name);
                const orderSum = o.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
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
                    statsMap[item.name].totalPrice += (item.quantity * Number(item.price));
                });
            });

            let myItemsSummary = "";
            let myTotal = 0;

            if (myOrder) {
                const myOrderTyped = myOrder as (Order & { items: OrderItem[] });
                myItemsSummary = myOrderTyped.items.map(i => `${i.name}*${i.quantity}`).join(', ');
                myTotal = myOrderTyped.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
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
                    id: (myOrder as Order).id,
                    itemsSummary: myItemsSummary,
                    total: myTotal,
                    items: (myOrder as (Order & { items: OrderItem[] })).items,
                    paymentStatus: (myOrder as Order).paymentStatus,
                    updatedAt: (myOrder as Order).updatedAt
                } : null,
                isCreator: g.creatorId === userId
            };
        });
    }

    /**
     * Creates a new group.
     * @param userId - Creator's ID.
     * @param data - Group data (title, startTime, endTime, products, invitedUserIds, initialOrder).
     * @returns The created group.
     */
    async createGroup(userId: number, data: GroupData) {
        const { title, startTime, endTime, products, invitedUserIds, initialOrder } = data;

        return await prisma.group.create({
            data: {
                title,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                creatorId: userId,
                status: 'OPEN',
                products: {
                    create: products.map(p => ({
                        name: p.name,
                        price: Number(p.price)
                    }))
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
     * @param userId - Requesting user ID.
     * @param groupId - Group ID.
     * @param data - Update data (title, dates, products, invitedUserIds).
     * @returns Result message and updated products.
     */
    async updateGroup(userId: number, groupId: number, data: GroupData) {
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
            await prisma.order.createMany({
                data: toAdd.map(uid => ({
                    userId: uid,
                    groupId: groupId
                }))
            });
        }

        // Remove uninvited
        const toRemove = existingUserIds.filter(uid => !targetUserIds.has(uid) && uid !== userId);
        if (toRemove.length > 0) {
            const ordersToDelete = await prisma.order.findMany({
                where: {
                    groupId: groupId,
                    userId: { in: toRemove }
                },
                select: { id: true }
            });
            const orderIds = ordersToDelete.map(o => o.id);

            if (orderIds.length > 0) {
                await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
                await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
            }
        }

        // --- Product Sync ---
        if (products && Array.isArray(products)) {
            const updates = products.filter(p => p.id).map(p =>
                prisma.groupProduct.update({
                    where: { id: p.id },
                    data: { name: p.name, price: Number(p.price) }
                })
            );

            const creates = products.filter(p => !p.id).map(p =>
                prisma.groupProduct.create({
                    data: { name: p.name, price: Number(p.price), groupId: groupId }
                })
            );

            const keepIds = products.filter(p => p.id).map(p => p.id as number);
            const productsToDelete = await prisma.groupProduct.findMany({
                where: { groupId: groupId, id: { notIn: keepIds } }
            });

            if (productsToDelete.length > 0) {
                const namesToDelete = productsToDelete.map(p => p.name);
                const usedItem = await prisma.orderItem.findFirst({
                    where: {
                        order: { groupId: groupId },
                        name: { in: namesToDelete }
                    }
                });

                if (usedItem) {
                    throw new Error(`Cannot delete item "${usedItem.name}" because it has been ordered by a member.`);
                }

                const deleteOp = prisma.groupProduct.deleteMany({
                    where: { id: { in: productsToDelete.map(p => p.id) } }
                });

                await prisma.$transaction([...updates, ...creates, deleteOp]);
            } else {
                // Sync name/price updates to OrderItems
                const existingProducts = await prisma.groupProduct.findMany({ where: { groupId } });
                const syncOps = [];
                for (const newProd of products) {
                    if (newProd.id) {
                        const oldProd = existingProducts.find(p => p.id === newProd.id);
                        if (oldProd && (oldProd.name !== newProd.name || Number(oldProd.price) !== Number(newProd.price))) {
                            syncOps.push(
                                prisma.orderItem.updateMany({
                                    where: { order: { groupId: groupId }, name: oldProd.name },
                                    data: { name: newProd.name, price: Number(newProd.price) }
                                })
                            );
                        }
                    }
                }
                await prisma.$transaction([...updates, ...creates, ...syncOps]);
            }
        }

        return await prisma.groupProduct.findMany({ where: { groupId } });
    }

    /**
     * Deletes a group.
     * @param userId 
     * @param groupId 
     */
    async deleteGroup(userId: number, groupId: number) {
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error('Group not found');
        if (group.creatorId !== userId) throw new Error('Not authorized');

        const unpaidOrders = await prisma.order.findFirst({
            where: { groupId, paymentStatus: 'UNPAID' }
        });
        if (unpaidOrders) throw new Error('Cannot delete group: Some members have not paid.');

        const groupOrders = await prisma.order.findMany({ where: { groupId }, select: { id: true } });
        const orderIds = groupOrders.map(o => o.id);

        await prisma.$transaction([
            prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
            prisma.order.deleteMany({ where: { groupId } }),
            prisma.groupProduct.deleteMany({ where: { groupId } }),
            prisma.group.delete({ where: { id: groupId } })
        ]);
    }

    /**
     * Updates group status.
     * @param userId 
     * @param groupId 
     * @param status 
     */
    async updateGroupStatus(userId: number, groupId: number, status: string) {
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

export default new GroupService();
