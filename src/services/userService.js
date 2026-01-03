const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Service for User management.
 */
class UserService {

    /**
     * Search users by name or ID.
     * @param {string} userId - Requesting user ID (to exclude self).
     * @param {string} query - Search string.
     * @returns {Promise<Array>}
     */
    async searchUsers(userId, query) {
        if (!query) throw new Error('Query parameter "q" is required');

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } }
                ],
                NOT: {
                    id: userId
                }
            },
            select: {
                id: true,
                username: true,
                name: true
            },
            take: 10
        });

        // Exact ID match check
        const idUser = await prisma.user.findUnique({
            where: { id: query },
            select: { id: true, username: true, name: true }
        });
        if (idUser && idUser.id !== userId) {
            if (!users.find(u => u.id === idUser.id)) {
                users.unshift(idUser);
            }
        }
        if (idUser && idUser.id !== userId) {
            if (!users.find(u => u.id === idUser.id)) {
                users.unshift(idUser);
            }
        }

        return users;
    }

    /**
     * Adds a friend (bidirectional).
     * @param {string} userId 
     * @param {string} friendId 
     * @returns {Promise<void>}
     */
    async addFriend(userId, friendId) {
        if (!friendId) throw new Error('friendId is required');
        if (userId === friendId) throw new Error('Cannot add self as friend');

        // Check compatibility with existing friendship
        const existingFriendship = await prisma.user.findFirst({
            where: {
                id: userId,
                friends: {
                    some: { id: friendId }
                }
            }
        });

        if (existingFriendship) throw new Error('Already friends');

        // Bidirectional update
        await prisma.user.update({
            where: { id: userId },
            data: {
                friends: { connect: { id: friendId } }
            }
        });

        await prisma.user.update({
            where: { id: friendId },
            data: {
                friends: { connect: { id: userId } }
            }
        });
    }

    /**
     * Get user's friend list.
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getFriends(userId) {
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

        return user ? user.friends : [];
    }
}

module.exports = new UserService();
