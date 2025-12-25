const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // Clean up
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();

    // Create Users
    const password = await bcrypt.hash('password', 10);

    const amy = await prisma.user.create({
        data: { username: 'amy', password, name: 'Amy' }
    });

    const bob = await prisma.user.create({
        data: { username: 'bob', password, name: 'Bob' }
    });

    const david = await prisma.user.create({
        data: { username: 'david', password, name: 'David' }
    });

    const sam = await prisma.user.create({
        data: { username: 'sam', password, name: 'Sam' }
    });

    // Create Group 1: KFC (Coordinator: Amy)
    // Time: 2025/12/24 15:00-17:00
    const kfc = await prisma.group.create({
        data: {
            title: 'KFC',
            startTime: new Date('2025-12-24T15:00:00'),
            endTime: new Date('2025-12-24T17:00:00'),
            creatorId: amy.id,
            status: 'OPEN'
        }
    });

    // Orders for KFC
    // Amy's order
    await prisma.order.create({
        data: {
            userId: amy.id,
            groupId: kfc.id,
            items: {
                create: [
                    { name: 'Hamburger', price: 100, quantity: 1 },
                    { name: 'Fries', price: 40, quantity: 4 },
                    { name: 'nugget', price: 50, quantity: 6 },
                    { name: 'coke', price: 30, quantity: 1 }
                ]
            },
            paymentStatus: 'PAID'
        }
    });

    // Bob's order
    await prisma.order.create({
        data: {
            userId: bob.id,
            groupId: kfc.id,
            items: {
                create: [{ name: 'Chicken', price: 150, quantity: 2 }]
            }
        }
    });

    // David's order (just joined)
    await prisma.order.create({
        data: {
            userId: david.id,
            groupId: kfc.id,
            items: {
                create: []
            }
        }
    });

    // Sam's order
    await prisma.order.create({
        data: {
            userId: sam.id,
            groupId: kfc.id,
            items: {
                create: [{ name: 'Fries', price: 40, quantity: 1 }]
            }
        }
    });


    // Create Group 2: Burger King (Coordinator: Bob)
    const bk = await prisma.group.create({
        data: {
            title: 'Burger King',
            startTime: new Date('2025-12-25T14:00:00'),
            endTime: new Date('2025-12-25T16:00:00'),
            creatorId: bob.id, // Bob
            status: 'OPEN'
        }
    });

    // Amy is a participant? The image shows Card 2.
    // If Amy logs in, she sees KFC (her group) and BK (Bob's group).
    // Does she see BK only if she joined?
    // Use Dashboard logic: user sees groups they are in (created or ordered).
    // So Amy must have an order in BK for it to show?
    // Or maybe "Friends" groups show up?
    // For now, let's make Amy join BK so it shows up.
    await prisma.order.create({
        data: {
            userId: amy.id,
            groupId: bk.id,
            items: {
                create: [
                    { name: 'Whopper', price: 150, quantity: 1 }
                ]
            }
        }
    });

    await prisma.order.create({
        data: {
            userId: bob.id,
            groupId: bk.id,
            items: {
                create: [
                    { name: 'Hamburger', price: 45, quantity: 5 },
                    { name: 'Fries', price: 40, quantity: 3 },
                    { name: 'nugget', price: 50, quantity: 8 },
                    { name: 'coke', price: 30, quantity: 2 }
                ]
            }
        }
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
