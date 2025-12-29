import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service for User management.
 */
class UserService {

    /**
     * Search users by name or ID.
     * @param userId - Requesting user ID (to exclude self).
     * @param query - Search string.
     * @returns List of found users
     */
    async searchUsers(userId: number, query: string): Promise<Partial<User>[]> {
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
        if (!isNaN(Number(query))) {
            const idUser = await prisma.user.findUnique({
                where: { id: parseInt(query) },
                select: { id: true, username: true, name: true }
            });
            if (idUser && idUser.id !== userId) {
                // Check if already in list
                if (!users.find(u => u.id === idUser.id)) {
                    users.unshift(idUser);
                }
            }
        }

        return users;
    }

    /**
     * Adds a friend (bidirectional).
     * @param userId 
     * @param friendId 
     */
    async addFriend(userId: number, friendId: number): Promise<void> {
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
     * @param userId 
     * @returns List of friends
     */
    async getFriends(userId: number): Promise<{ id: number; username: string; name: string | null }[]> {
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

export default new UserService();
