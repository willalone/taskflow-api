import { Router } from 'express';
import { NotificationService } from './notification.service.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import { param } from '../../shared/utils/params.js';

const notifications = new NotificationService();
export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const unreadOnly = req.query.unread === 'true' || req.query.isRead === 'false';
    const list = await notifications.listForUser(req.user!.id, unreadOnly);
    res.json({ success: true, data: list });
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req: AuthRequest, res) => {
    await notifications.markRead(param(req, 'id'), req.user!.id);
    res.json({ success: true });
  }),
);
