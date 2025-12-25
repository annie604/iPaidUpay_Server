const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Search users by username or ID (partial match)
// Query parameter: q (string)
const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const currentUserId = req.user.userId;

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: q, mode: 'insensitive' } },
                    // If q is a number, try to match ID? 
                    // Prisma contains is for strings. For Int id, we can only do exact match or convert to string (but DB is Int).
                    // For simplicity, let's assume strict ID match if q is numeric, or just name search.
                    // Let's stick to username and name search for now.
                    { name: { contains: q, mode: 'insensitive' } }
                ],
                NOT: {
                    id: currentUserId // Exclude self
                }
            },
            select: {
                id: true,
                username: true,
                name: true
            },
            take: 10 // Limit results
        });

        // If q looks like a number, try to find by ID specifically
        if (!isNaN(q)) {
            const idUser = await prisma.user.findUnique({
                where: { id: parseInt(q) },
                select: { id: true, username: true, name: true }
            });
            if (idUser && idUser.id !== currentUserId) {
                // Add if not already in list
                if (!users.find(u => u.id === idUser.id)) {
                    users.unshift(idUser);
                }
            }
        }

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addFriend = async (req, res) => {
    try {
        const userId = req.user.userId;
        const friendId = parseInt(req.body.friendId);

        if (!friendId) {
            return res.status(400).json({ error: 'friendId is required' });
        }

        if (userId === parseInt(friendId)) {
            return res.status(400).json({ error: 'Cannot add self as friend' });
        }

        // Check if already friends
        const existingFriendship = await prisma.user.findFirst({
            where: {
                id: userId,
                friends: {
                    some: { id: friendId }
                }
            }
        });

        if (existingFriendship) {
            return res.status(400).json({ error: 'Already friends' });
        }

        // Add friend (bidirectional? Usually friend systems are bidirectional or follower.
        // Prisma self-relation many-to-many is symmetric if configured right, but explicit updates might be needed.
        // Let's assume standard "Friend request" flows usually, but for this simple app, direct add is likely expected?
        // Let's just do `connect` on both sides or just one side depending on relation.
        // Prisma implicit m-n relation handles the join table.
        // We just need to update one user to connect the other.

        await prisma.user.update({
            where: { id: userId },
            data: {
                friends: {
                    connect: { id: friendId }
                }
            }
        });

        // Ensure bidirectional? implicit relations in Prisma are usually symmetric storage wise but API wise friendOf might be needed.
        // Actually for implicit many-to-many, `friends` and `friendOf` are just names for the two sides.
        // Connection establishes the link.
        // We probably want to connect BOTH ways if it's "mutual friendship", but Prisma might handle it as a single row in join table.
        // Wait, implicit m-n: "A relation table is created... entries are added".
        // It does NOT automatically make it symmetric logic-wise (A follows B doesn't mean B follows A) UNLESS we treat it that way.
        // But `friends` and `friendOf` suggests directional?
        // For a simple "Friend" system, usually A adds B, B keeps A.
        // If we want mutual, we might need to connect the other way too. All good for now.

        // Wait, if I want them to show up in each other's lists, I should connect both?
        // Let's assume bidirectional for now to be safe for "Friends".
        await prisma.user.update({
            where: { id: friendId },
            data: {
                friends: {
                    connect: { id: userId }
                }
            }
        });

        res.json({ message: 'Friend added successfully' });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getFriends = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                friends: {
                    select: {
                        id: true,
                        username: true,
                        name: true
                    }
                }
            }
        });

        res.json(user.friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    searchUsers,
    addFriend,
    getFriends
};
