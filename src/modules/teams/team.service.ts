import { TeamRole, InvitationStatus, NotificationType } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { generateToken } from '../../shared/utils/password.js';
import { loadEnv } from '../../config/env.js';
import { sendEmail } from '../../shared/services/email.service.js';
import { requireTeamAdmin, requireTeamMember } from '../tasks/permissions.service.js';
import { NotificationService } from '../notifications/notification.service.js';

const env = loadEnv();

export class TeamService {
  private readonly notifications = new NotificationService();
  async create(userId: string, name: string, description?: string) {
    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name, description, ownerId: userId },
      });
      await tx.teamMember.create({
        data: { teamId: team.id, userId, role: TeamRole.ADMIN },
      });
      return team;
    });
  }

  async listForUser(userId: string) {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true, projects: true } },
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    return memberships.map((m) => ({ ...m.team, role: m.role }));
  }

  async getById(teamId: string, userId: string) {
    await requireTeamMember(teamId, userId);
    return prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        _count: { select: { projects: true } },
      },
    });
  }

  async update(teamId: string, userId: string, data: { name?: string; description?: string }) {
    await requireTeamAdmin(teamId, userId);
    return prisma.team.update({ where: { id: teamId }, data });
  }

  async invite(teamId: string, inviterId: string, email: string, role: TeamRole = TeamRole.MEMBER) {
    await requireTeamAdmin(teamId, inviterId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw AppError.notFound('Team not found');

    const existingMember = await prisma.user.findUnique({ where: { email } });
    if (existingMember) {
      const member = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingMember.id } },
      });
      if (member) throw AppError.conflict('User already in team');
    }

    const token = generateToken();
    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        email,
        token,
        role,
        invitedBy: inviterId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });

    const inviteUrl = `${env.APP_URL}/api/v1/teams/invite/${token}/accept`;
    await sendEmail(
      email,
      `Invitation to join ${team.name}`,
      `<p>You were invited to <strong>${team.name}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    );

    return { invitationId: invitation.id, expiresAt: invitation.expiresAt };
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { team: true },
    });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw AppError.badRequest('Invalid invitation');
    }
    if (invitation.expiresAt < new Date()) {
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw AppError.badRequest('Invitation expired');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw AppError.forbidden('Invitation email does not match your account');
    }

    await prisma.$transaction([
      prisma.teamMember.create({
        data: { teamId: invitation.teamId, userId, role: invitation.role },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      }),
    ]);

    await this.notifications.createInApp(
      userId,
      NotificationType.INVITATION,
      `You joined team "${invitation.team.name}"`,
      { teamId: invitation.teamId },
    );

    return { teamId: invitation.teamId, teamName: invitation.team.name };
  }

  async updateMemberRole(teamId: string, adminId: string, memberId: string, role: TeamRole) {
    await requireTeamAdmin(teamId, adminId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team?.ownerId === memberId && role !== TeamRole.ADMIN) {
      throw AppError.badRequest('Cannot demote team owner');
    }
    return prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: memberId } },
      data: { role },
    });
  }

  async removeMember(teamId: string, adminId: string, memberUserId: string) {
    await requireTeamAdmin(teamId, adminId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team?.ownerId === memberUserId) {
      throw AppError.badRequest('Cannot remove team owner');
    }

    const count = await prisma.teamMember.count({ where: { teamId } });
    if (count <= 1) throw AppError.badRequest('Cannot remove the last member');

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: memberUserId } },
    });
    return { success: true };
  }

  async leave(teamId: string, userId: string) {
    const count = await prisma.teamMember.count({ where: { teamId } });
    if (count <= 1) throw AppError.badRequest('Cannot leave as the last member');

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team?.ownerId === userId) {
      throw AppError.badRequest('Owner must transfer ownership before leaving');
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    return { success: true };
  }
}
