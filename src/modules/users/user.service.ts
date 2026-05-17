import { prisma } from '../../shared/lib/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            teamMemberships: true,
            tasksAssigned: true,
            tasksCreated: true,
          },
        },
      },
    });
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { name?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, isActive: true, updatedAt: true },
    });
  }

  async getById(requesterId: string, targetId: string) {
    const sharedTeam = await prisma.teamMember.findFirst({
      where: {
        userId: requesterId,
        team: { members: { some: { userId: targetId } } },
      },
    });
    if (!sharedTeam && requesterId !== targetId) {
      throw AppError.forbidden('Cannot view this user');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) throw AppError.notFound('User not found');
    return user;
  }
}
