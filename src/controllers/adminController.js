const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.executeSql = async (req, res) => {
    try {
        const { username } = req.user;
        const { query } = req.body;

        // Strict Access Control
        // Strict Access Control
        if (!['OmegaAdmin', 'SupremeAdmin'].includes(username)) {
            console.warn(`Unauthorized SQL execution attempt by user: ${username}`);
            return res.status(403).json({ error: 'Access denied: Admin only' });
        }

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`Executing SQL by Admin: ${query}`);

        // Execute raw SQL using Prisma
        // $queryRawUnsafe is risky but necessary for a terminal-like feature
        const result = await prisma.$queryRawUnsafe(query);

        // Handle BigInt serialization if necessary (Prisma returns BigInt for some types)
        const serializedResult = JSON.parse(JSON.stringify(result, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
        ));

        res.json({ result: serializedResult });
    } catch (error) {
        console.error('SQL Execution Error:', error);
        res.status(500).json({ error: error.message || 'SQL execution failed' });
    }
};
