import { describe, it, expect } from 'vitest';
import { TeamRole, ProjectRole } from '@prisma/client';
import { canCreateTask, canEditTask } from '../../src/modules/tasks/permissions.service.js';

describe('permissions', () => {
  const task = { createdById: 'u1', assigneeId: 'u2' };

  it('admin can edit any task', () => {
    expect(canEditTask(TeamRole.ADMIN, null, 'u3', task)).toBe(true);
  });

  it('viewer cannot edit', () => {
    expect(canEditTask(TeamRole.VIEWER, ProjectRole.DEVELOPER, 'u1', task)).toBe(false);
  });

  it('assignee can edit', () => {
    expect(canEditTask(TeamRole.MEMBER, null, 'u2', task)).toBe(true);
  });

  it('viewer cannot create tasks', () => {
    expect(canCreateTask(TeamRole.VIEWER, ProjectRole.DEVELOPER)).toBe(false);
  });

  it('project manager can create', () => {
    expect(canCreateTask(TeamRole.MEMBER, ProjectRole.PROJECT_MANAGER)).toBe(true);
  });
});
