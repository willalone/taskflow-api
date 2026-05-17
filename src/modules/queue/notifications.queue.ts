import { Queue, Worker } from 'bullmq';
import { loadEnv } from '../../config/env.js';
import { prisma } from '../../shared/lib/prisma.js';
import { NotificationService } from '../notifications/notification.service.js';
import { logger } from '../../shared/lib/logger.js';

const env = loadEnv();
const connection = { url: env.REDIS_URL };

export const notificationsQueue = new Queue('notifications', {
  connection,
  prefix: env.BULL_PREFIX,
});

export const maintenanceQueue = new Queue('maintenance', {
  connection,
  prefix: env.BULL_PREFIX,
});

export async function scheduleDeadlineNotifications(taskId: string, deadline: Date) {
  const now = Date.now();
  const msLeft = deadline.getTime() - now;

  for (const hours of [24, 1]) {
    const delay = msLeft - hours * 3600_000;
    if (delay > 0) {
      await notificationsQueue.add(
        'deadline-approaching',
        { taskId, hoursLeft: hours },
        { delay, jobId: `deadline-${taskId}-${hours}h`, removeOnComplete: true },
      );
    }
  }
}

export async function cancelDeadlineNotifications(taskId: string) {
  for (const hours of [24, 1]) {
    const job = await notificationsQueue.getJob(`deadline-${taskId}-${hours}h`);
    if (job) await job.remove();
  }
}

export function registerWorkers() {
  const notificationService = new NotificationService();

  new Worker(
    'notifications',
    async (job) => {
      if (job.name === 'deadline-approaching') {
        const { taskId, hoursLeft } = job.data as { taskId: string; hoursLeft: number };
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true },
        });
        if (!task?.assigneeId || !task.assignee || task.status === 'DONE') return;

        await notificationService.notifyDeadline(
          task.assigneeId,
          task.title,
          hoursLeft,
          task.assignee.email,
        );
      }
    },
    { connection, prefix: env.BULL_PREFIX },
  );

  new Worker(
    'maintenance',
    async (job) => {
      if (job.name === 'cleanup-refresh-tokens') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - env.REFRESH_TOKEN_CLEANUP_DAYS);
        const result = await prisma.refreshToken.deleteMany({
          where: {
            OR: [{ expiresAt: { lt: cutoff } }, { revoked: true, expiresAt: { lt: new Date() } }],
          },
        });
        logger.info({ count: result.count }, 'Cleaned up refresh tokens');
      }
    },
    { connection, prefix: env.BULL_PREFIX },
  );

  logger.info('BullMQ workers registered');
}

export async function scheduleRecurringJobs() {
  await maintenanceQueue.add(
    'cleanup-refresh-tokens',
    {},
    { repeat: { pattern: '0 3 * * 0' }, jobId: 'weekly-refresh-cleanup' },
  );

  const tasks = await prisma.task.findMany({
    where: { status: { not: 'DONE' }, deadline: { not: null }, assigneeId: { not: null } },
  });

  for (const task of tasks) {
    if (task.deadline) await scheduleDeadlineNotifications(task.id, task.deadline);
  }
}
