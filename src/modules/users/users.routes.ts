import { Router } from 'express';
import { z } from 'zod';
import { UserService } from './user.service.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import { param } from '../../shared/utils/params.js';

const users = new UserService();
export const usersRouter = Router();

usersRouter.use(authenticate);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

usersRouter.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await users.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  }),
);

usersRouter.patch(
  '/me',
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const profile = await users.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: profile });
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const user = await users.getById(req.user!.id, param(req, 'id'));
    res.json({ success: true, data: user });
  }),
);
