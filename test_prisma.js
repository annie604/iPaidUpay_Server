const { PrismaClient } = require('@prisma/client');

try {
    console.log('Initializing Prisma...');
    const prisma = new PrismaClient();
    console.log('Prisma initialized successfully.');

    async function main() {
        const count = await prisma.user.count();
        console.log('User count:', count);
    }

    main();
} catch (error) {
    console.error('Error initializing Prisma:', error);
}
