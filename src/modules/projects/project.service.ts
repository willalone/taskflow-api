import { ProjectRole } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  requireTeamAdmin,
  requireTeamMember,
  requireProjectManagerOrTeamAdmin,
} from '../tasks/permissions.service.js';

export class ProjectService {
  async create(teamId: string, userId: string, name: string, description?: string) {
    await requireTeamAdmin(teamId, userId);
    return prisma.project.create({
      data: { teamId, name, description, createdBy: userId },
    });
  }

  async list(teamId: string, userId: string) {
    await requireTeamMember(teamId, userId);
    return prisma.project.findMany({
      where: { teamId },
      include: { _count: { select: { tasks: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        team: { select: { id: true, name: true } },
      },
    });
    if (!project) throw AppError.notFound('Project not found');
    await requireTeamMember(project.teamId, userId);
    return project;
  }

  async update(projectId: string, userId: string, data: { name?: string; description?: string }) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');
    await requireTeamAdmin(project.teamId, userId);
    return prisma.project.update({ where: { id: projectId }, data });
  }

  async delete(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');
    await requireTeamAdmin(project.teamId, userId);
    await prisma.project.delete({ where: { id: projectId } });
    return { success: true };
  }

  async addMember(projectId: string, actorId: string, memberUserId: string, role: ProjectRole) {
    await requireProjectManagerOrTeamAdmin(projectId, actorId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Project not found');

    const teamMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId: memberUserId } },
    });
    if (!teamMember) throw AppError.badRequest('User must be a team member first');

    return prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: memberUserId } },
      create: { projectId, userId: memberUserId, role },
      update: { role },
    });
  }

  async removeMember(projectId: string, actorId: string, memberUserId: string) {
    await requireProjectManagerOrTeamAdmin(projectId, actorId);
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });
    return { success: true };
  }
}
