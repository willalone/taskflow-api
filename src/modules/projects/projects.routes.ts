import { Router } from 'express';
import { ProjectRole } from '@prisma/client';
import { z } from 'zod';
import { ProjectService } from './project.service.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import { param } from '../../shared/utils/params.js';

const projects = new ProjectService();
export const projectsRouter = Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(ProjectRole),
});

projectsRouter.use(authenticate);

projectsRouter.post(
  '/teams/:teamId',
  validate(createProjectSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const project = await projects.create(
      param(req, 'teamId'),
      req.user!.id,
      req.body.name,
      req.body.description,
    );
    res.status(201).json({ success: true, data: project });
  }),
);

projectsRouter.get(
  '/teams/:teamId',
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await projects.list(param(req, 'teamId'), req.user!.id);
    res.json({ success: true, data: list });
  }),
);

projectsRouter.get(
  '/:projectId',
  asyncHandler(async (req: AuthRequest, res) => {
    const project = await projects.getById(param(req, 'projectId'), req.user!.id);
    res.json({ success: true, data: project });
  }),
);

projectsRouter.patch(
  '/:projectId',
  validate(createProjectSchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const project = await projects.update(param(req, 'projectId'), req.user!.id, req.body);
    res.json({ success: true, data: project });
  }),
);

projectsRouter.delete(
  '/:projectId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await projects.delete(param(req, 'projectId'), req.user!.id);
    res.json({ success: true, data: result });
  }),
);

projectsRouter.post(
  '/:projectId/members',
  validate(addMemberSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const member = await projects.addMember(
      param(req, 'projectId'),
      req.user!.id,
      req.body.userId,
      req.body.role,
    );
    res.status(201).json({ success: true, data: member });
  }),
);

projectsRouter.delete(
  '/:projectId/members/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await projects.removeMember(
      param(req, 'projectId'),
      req.user!.id,
      param(req, 'userId'),
    );
    res.json({ success: true, data: result });
  }),
);
