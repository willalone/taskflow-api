import { Router } from 'express';
import { z } from 'zod';
import { TaskService } from './task.service.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskListQuerySchema,
  commentSchema,
} from './task.schema.js';
import { param } from '../../shared/utils/params.js';

const tasks = new TaskService();
export const tasksRouter = Router();

tasksRouter.use(authenticate);

tasksRouter.get(
  '/search',
  validate(taskListQuerySchema.extend({ q: z.string().min(1) }), 'query'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { q, ...query } = req.query as { q: string } & Record<string, unknown>;
    const result = await tasks.search(req.user!.id, q, query);
    res.json({ success: true, ...result });
  }),
);

tasksRouter.post(
  '/projects/:projectId',
  validate(createTaskSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const task = await tasks.create(param(req, 'projectId'), req.user!.id, req.body);
    res.status(201).json({ success: true, data: task });
  }),
);

tasksRouter.get(
  '/projects/:projectId',
  validate(taskListQuerySchema, 'query'),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await tasks.list(param(req, 'projectId'), req.user!.id, req.query);
    res.json({ success: true, ...result });
  }),
);

tasksRouter.get(
  '/:taskId',
  asyncHandler(async (req: AuthRequest, res) => {
    const task = await tasks.getById(param(req, 'taskId'), req.user!.id);
    res.json({ success: true, data: task });
  }),
);

tasksRouter.patch(
  '/:taskId',
  validate(updateTaskSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const task = await tasks.update(param(req, 'taskId'), req.user!.id, req.body);
    res.json({ success: true, data: task });
  }),
);

tasksRouter.delete(
  '/:taskId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await tasks.delete(param(req, 'taskId'), req.user!.id);
    res.json({ success: true, data: result });
  }),
);

tasksRouter.post(
  '/:taskId/comments',
  validate(commentSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const comment = await tasks.addComment(param(req, 'taskId'), req.user!.id, req.body.content);
    res.status(201).json({ success: true, data: comment });
  }),
);

tasksRouter.get(
  '/:taskId/comments',
  asyncHandler(async (req: AuthRequest, res) => {
    const comments = await tasks.listComments(param(req, 'taskId'), req.user!.id);
    res.json({ success: true, data: comments });
  }),
);
