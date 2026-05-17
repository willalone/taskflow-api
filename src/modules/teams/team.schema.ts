import { z } from 'zod';
import { TeamRole } from '@prisma/client';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(TeamRole).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(TeamRole),
});
