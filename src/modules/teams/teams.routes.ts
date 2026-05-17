import { Router } from 'express';
import { TeamService } from './team.service.js';
import { authenticate, type AuthRequest } from '../../shared/middleware/auth.js';
import { validate } from '../../shared/middleware/validate.js';
import { asyncHandler } from '../../shared/middleware/asyncHandler.js';
import { createTeamSchema, inviteSchema, updateMemberRoleSchema } from './team.schema.js';
import { param } from '../../shared/utils/params.js';

const teams = new TeamService();
export const teamsRouter = Router();

teamsRouter.use(authenticate);

teamsRouter.post(
  '/',
  validate(createTeamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const team = await teams.create(req.user!.id, req.body.name, req.body.description);
    res.status(201).json({ success: true, data: team });
  }),
);

teamsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const list = await teams.listForUser(req.user!.id);
    res.json({ success: true, data: list });
  }),
);

teamsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const team = await teams.getById(param(req, 'id'), req.user!.id);
    res.json({ success: true, data: team });
  }),
);

teamsRouter.patch(
  '/:id',
  validate(createTeamSchema.partial()),
  asyncHandler(async (req: AuthRequest, res) => {
    const team = await teams.update(param(req, 'id'), req.user!.id, req.body);
    res.json({ success: true, data: team });
  }),
);

teamsRouter.post(
  '/:id/invite',
  validate(inviteSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await teams.invite(
      param(req, 'id'),
      req.user!.id,
      req.body.email,
      req.body.role,
    );
    res.status(201).json({ success: true, data: result });
  }),
);

teamsRouter.post(
  '/invite/:token/accept',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await teams.acceptInvitation(param(req, 'token'), req.user!.id);
    res.json({ success: true, data: result });
  }),
);

teamsRouter.patch(
  '/:teamId/members/:userId',
  validate(updateMemberRoleSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const member = await teams.updateMemberRole(
      param(req, 'teamId'),
      req.user!.id,
      param(req, 'userId'),
      req.body.role,
    );
    res.json({ success: true, data: member });
  }),
);

teamsRouter.delete(
  '/:teamId/members/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await teams.removeMember(
      param(req, 'teamId'),
      req.user!.id,
      param(req, 'userId'),
    );
    res.json({ success: true, data: result });
  }),
);

teamsRouter.delete(
  '/:teamId/leave',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await teams.leave(param(req, 'teamId'), req.user!.id);
    res.json({ success: true, data: result });
  }),
);
