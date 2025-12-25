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
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = groups.map(g => {
            let totalGroupAmount = 0;
            const participantsSet = new Set();
            let myOrder = null;

            g.orders.forEach(o => {
                participantsSet.add(o.user.name);
                const orderSum = o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                totalGroupAmount += orderSum;

                if (o.userId === userId) {
                    myOrder = o;
                }
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
                totalGroupAmount: totalGroupAmount,
                myOrder: myOrder ? {
                    id: myOrder.id,
                    itemsSummary: myItemsSummary,
                    total: myTotal,
                    items: myOrder.items,
                    paymentStatus: myOrder.paymentStatus
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
        const { title, startTime, endTime, products } = req.body;
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
                }
            },
            include: {
                products: true
            }
        });

        res.status(201).json(newGroup);
    } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

module.exports = {
    getDashboardGroups,
    createGroup
};
