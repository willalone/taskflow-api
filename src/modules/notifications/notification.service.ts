import { NotificationType } from '@prisma/client';
import { prisma } from '../../shared/lib/prisma.js';
import { sendEmail } from '../../shared/services/email.service.js';

export class NotificationService {
  async createInApp(
    userId: string,
    type: NotificationType,
    content: string,
    metadata?: object,
  ) {
    return prisma.notification.create({
      data: { userId, type, content, metadata: metadata ?? undefined },
    });
  }

  async notifyDeadline(userId: string, taskTitle: string, hoursLeft: number, email: string) {
    const content = `Task "${taskTitle}" is due in approximately ${hoursLeft} hour(s).`;
    await this.createInApp(userId, NotificationType.DEADLINE_APPROACHING, content, {
      taskTitle,
      hoursLeft,
    });
    await sendEmail(email, `Deadline in ${hoursLeft}h: ${taskTitle}`, `<p>${content}</p>`);
  }

  async listForUser(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }
}
