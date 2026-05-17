import { Router } from 'express';
import { AuthService } from './auth.service.js';
import { validate } from '../../shared/middleware/validate.js';
import { authRateLimiter } from '../../shared/middleware/rateLimit.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';

const auth = new AuthService();
export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await auth.register(req.body.email, req.body.password, req.body.name);
    res.status(201).json({ success: true, data: user });
  }),
);

authRouter.get(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    const result = await auth.verifyEmail(token);
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const tokens = await auth.login(req.body.email, req.body.password);
    res.json({ success: true, data: tokens });
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const tokens = await auth.refresh(req.body.refreshToken);
    res.json({ success: true, data: tokens });
  }),
);

authRouter.post(
  '/logout',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await auth.logout(req.body.refreshToken);
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await auth.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await auth.requestPasswordReset(req.body.email);
    res.json({ success: true, data: result });
  }),
);

authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await auth.resetPassword(req.body.token, req.body.newPassword);
    res.json({ success: true, data: result });
  }),
);
