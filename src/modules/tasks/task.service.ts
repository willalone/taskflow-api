import { Priority, TaskStatus, Prisma } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import {
  canCreateTask,
  canEditTask,
  getProjectMembership,
  requireProjectMember,
  requireTeamMember,
} from './permissions.service.js';
import {
  scheduleDeadlineNotifications,
  cancelDeadlineNotifications,
} from '../queue/notifications.queue.js';

interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  deadlineBefore?: Date;
  deadlineAfter?: Date;
}

interface TaskListQuery extends TaskFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const HISTORY_FIELDS = ['status', 'priority', 'assigneeId', 'deadline'] as const;

export class TaskService {
  private async getProjectContext(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true },
    });
    if (!project) throw AppError.notFound('Project not found');
    const teamMember = await requireTeamMember(project.teamId, userId);
    const projectMember = await getProjectMembership(projectId, userId);
    return { project, teamMember, projectMember };
  }

  async create(
    projectId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      priority?: Priority;
      assigneeId?: string;
      deadline?: Date;
    },
  ) {
    const { project, teamMember, projectMember } = await this.getProjectContext(projectId, userId);
    if (!canCreateTask(teamMember.role, projectMember?.role ?? null)) {
      throw AppError.forbidden('Cannot create tasks');
    }

    if (data.assigneeId) {
      const assigneeInTeam = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: project.teamId, userId: data.assigneeId } },
      });
      if (!assigneeInTeam) throw AppError.badRequest('Assignee must be a team member');
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        createdById: userId,
        title: data.title,
        description: data.description,
        priority: data.priority ?? Priority.MEDIUM,
        assigneeId: data.assigneeId,
        deadline: data.deadline,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    if (task.deadline && task.assigneeId) {
      await scheduleDeadlineNotifications(task.id, task.deadline);
    }

    return task;
  }

  async list(projectId: string, userId: string, query: TaskListQuery) {
    await this.getProjectContext(projectId, userId);

    const { page, limit, skip, sortOrder, sortBy } = parsePagination(query);
    const where: Prisma.TaskWhereInput = {
      projectId,
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.assigneeId && { assigneeId: query.assigneeId }),
      ...(query.deadlineBefore && { deadline: { lte: query.deadlineBefore } }),
      ...(query.deadlineAfter && { deadline: { gte: query.deadlineAfter } }),
    };

    const orderBy: Prisma.TaskOrderByWithRelationInput =
      sortBy === 'deadline'
        ? { deadline: sortOrder }
        : sortBy === 'priority'
          ? { priority: sortOrder }
          : { createdAt: sortOrder };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return paginatedResponse(tasks, total, page, limit);
  }

  async search(userId: string, q: string, query: TaskListQuery) {
    if (!q?.trim()) throw AppError.badRequest('Query parameter q is required');

    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);
    if (!teamIds.length) return paginatedResponse([], 0, 1, 20);

    const { page, limit, skip } = parsePagination(query);

    const rows = query.projectId
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT t.id FROM "Task" t
          WHERE t."projectId" = ${query.projectId}
            AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
              @@ plainto_tsquery('english', ${q})
          ORDER BY ts_rank(
            to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
            plainto_tsquery('english', ${q})
          ) DESC
          LIMIT ${limit} OFFSET ${skip}
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT t.id FROM "Task" t
          INNER JOIN "Project" p ON p.id = t."projectId"
          WHERE p."teamId" = ANY(${teamIds}::uuid[])
            AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
              @@ plainto_tsquery('english', ${q})
          ORDER BY ts_rank(
            to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, '')),
            plainto_tsquery('english', ${q})
          ) DESC
          LIMIT ${limit} OFFSET ${skip}
        `;

    const ids = rows.map((r) => r.id);
    const tasks = ids.length
      ? await prisma.task.findMany({
          where: { id: { in: ids } },
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        })
      : [];

    const ordered = ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);

    const countResult = query.projectId
      ? await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count FROM "Task" t
          WHERE t."projectId" = ${query.projectId}
            AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
              @@ plainto_tsquery('english', ${q})
        `
      : await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count FROM "Task" t
          INNER JOIN "Project" p ON p.id = t."projectId"
          WHERE p."teamId" = ANY(${teamIds}::uuid[])
            AND to_tsvector('english', coalesce(t.title, '') || ' ' || coalesce(t.description, ''))
              @@ plainto_tsquery('english', ${q})
        `;

    const total = Number(countResult[0]?.count ?? 0);
    return paginatedResponse(ordered, total, page, limit);
  }

  async getById(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        histories: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!task) throw AppError.notFound('Task not found');
    await requireProjectMember(task.projectId, userId);
    return task;
  }

  async update(
    taskId: string,
    userId: string,
    data: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: Priority;
      assigneeId: string | null;
      deadline: Date | null;
    }>,
  ) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw AppError.notFound('Task not found');

    const teamMember = await requireTeamMember(task.project.teamId, userId);
    const projectMember = await getProjectMembership(task.projectId, userId);

    if (
      !canEditTask(teamMember.role, projectMember?.role ?? null, userId, {
        createdById: task.createdById,
        assigneeId: task.assigneeId,
      })
    ) {
      throw AppError.forbidden('Cannot edit this task');
    }

    const historyEntries: Prisma.TaskHistoryCreateManyInput[] = [];
    for (const field of HISTORY_FIELDS) {
      if (data[field] !== undefined && String(data[field] ?? '') !== String(task[field] ?? '')) {
        historyEntries.push({
          taskId,
          changedBy: userId,
          field,
          oldValue: task[field] != null ? String(task[field]) : null,
          newValue: data[field] != null ? String(data[field]) : null,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (historyEntries.length) {
        await tx.taskHistory.createMany({ data: historyEntries });
      }
      return tx.task.update({
        where: { id: taskId },
        data,
        include: { assignee: { select: { id: true, name: true, email: true } } },
      });
    });

    await cancelDeadlineNotifications(taskId);
    if (updated.deadline && updated.assigneeId && updated.status !== 'DONE') {
      await scheduleDeadlineNotifications(taskId, updated.deadline);
    }

    return updated;
  }

  async delete(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw AppError.notFound('Task not found');

    const teamMember = await requireTeamMember(task.project.teamId, userId);
    const projectMember = await getProjectMembership(task.projectId, userId);
    if (
      !canEditTask(teamMember.role, projectMember?.role ?? null, userId, {
        createdById: task.createdById,
        assigneeId: task.assigneeId,
      })
    ) {
      throw AppError.forbidden('Cannot delete this task');
    }

    await cancelDeadlineNotifications(taskId);
    await prisma.task.delete({ where: { id: taskId } });
    return { success: true };
  }

  async addComment(taskId: string, userId: string, content: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw AppError.notFound('Task not found');
    await requireProjectMember(task.projectId, userId);

    return prisma.comment.create({
      data: { taskId, authorId: userId, content },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async listComments(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw AppError.notFound('Task not found');
    await requireProjectMember(task.projectId, userId);

    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    });
  }
}
