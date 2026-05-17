import { TeamRole, ProjectRole } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';

export async function getTeamMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export async function requireTeamMember(teamId: string, userId: string) {
  const member = await getTeamMembership(teamId, userId);
  if (!member) throw AppError.forbidden('Not a team member');
  return member;
}

export async function requireTeamAdmin(teamId: string, userId: string) {
  const member = await requireTeamMember(teamId, userId);
  if (member.role !== TeamRole.ADMIN) throw AppError.forbidden('Admin role required');
  return member;
}

export async function getProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function requireProjectMember(projectId: string, userId: string) {
  const member = await getProjectMembership(projectId, userId);
  if (!member) throw AppError.forbidden('Not a project member');
  return member;
}

export async function requireProjectManagerOrTeamAdmin(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw AppError.notFound('Project not found');

  const teamMember = await getTeamMembership(project.teamId, userId);
  if (teamMember?.role === TeamRole.ADMIN) return { teamMember, projectMember: null };

  const projectMember = await getProjectMembership(projectId, userId);
  if (projectMember?.role === ProjectRole.PROJECT_MANAGER) {
    return { teamMember, projectMember };
  }

  throw AppError.forbidden('Project manager or team admin required');
}

export function canEditTask(
  teamRole: TeamRole,
  projectRole: ProjectRole | null,
  userId: string,
  task: { createdById: string; assigneeId: string | null },
) {
  if (teamRole === TeamRole.ADMIN) return true;
  if (teamRole === TeamRole.VIEWER) return false;
  if (projectRole === ProjectRole.PROJECT_MANAGER) return true;
  if (task.createdById === userId || task.assigneeId === userId) return true;
  return false;
}

export function canCreateTask(teamRole: TeamRole, projectRole: ProjectRole | null) {
  if (teamRole === TeamRole.VIEWER) return false;
  if (teamRole === TeamRole.ADMIN) return true;
  return projectRole !== null;
}
