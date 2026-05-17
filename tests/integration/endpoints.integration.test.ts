import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { TeamRole, ProjectRole } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/shared/lib/prisma.js';
import { authHeader, login } from '../helpers/auth.js';

const run = process.env.CI === 'true' || process.env.RUN_INTEGRATION === 'true';

describe.skipIf(!run)('API integration', () => {
  const app = createApp();
  let adminToken: string;
  let memberToken: string;
  let refreshToken: string;
  let teamId: string;
  let projectId: string;
  let taskId: string;
  let notificationId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const admin = await login(app, 'admin@taskflow.dev', 'Password123!');
    adminToken = admin.accessToken;
    const member = await login(app, 'member@taskflow.dev', 'Password123!');
    memberToken = member.accessToken;
  });

  describe('Auth', () => {
    it('POST /auth/register returns 201', async () => {
      const email = `reg-${Date.now()}@taskflow.dev`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'Password123!', name: 'Reg User' });
      expect(res.status).toBe(201);
      await prisma.user.update({ where: { email }, data: { isActive: true } });
      const tokens = await login(app, email, 'Password123!');
      refreshToken = tokens.refreshToken;
    });

    it('POST /auth/refresh returns new tokens', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it('POST /auth/logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken });
      expect(res.status).toBe(200);
    });

    it('POST /auth/forgot-password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@taskflow.dev' });
      expect(res.status).toBe(200);
    });

    it('POST /auth/reset-password', async () => {
      const email = `reset-${Date.now()}@taskflow.dev`;
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: 'Password123!', name: 'Reset User' });
      await prisma.user.update({ where: { email }, data: { isActive: true } });

      await request(app).post('/api/v1/auth/forgot-password').send({ email });
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.passwordResetToken).toBeTruthy();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: user!.passwordResetToken, newPassword: 'NewPassword123!' });
      expect(res.status).toBe(200);

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'NewPassword123!' });
      expect(login.status).toBe(200);
    });

    it('POST /auth/reset-password rejects bad token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalid', newPassword: 'NewPassword123!' });
      expect(res.status).toBe(400);
    });

    it('POST /auth/change-password rejects wrong current', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set(authHeader(adminToken))
        .send({ currentPassword: 'wrong', newPassword: 'Password123!' });
      expect(res.status).toBe(400);
    });

    it('GET /auth/verify-email rejects invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/verify-email').query({ token: 'bad' });
      expect(res.status).toBe(400);
    });
  });

  describe('Users', () => {
    it('GET /users/me', async () => {
      const res = await request(app).get('/api/v1/users/me').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('admin@taskflow.dev');
    });

    it('PATCH /users/me', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set(authHeader(adminToken))
        .send({ name: 'Admin User' });
      expect(res.status).toBe(200);
    });
  });

  describe('Teams', () => {
    it('POST /teams creates team', async () => {
      const res = await request(app)
        .post('/api/v1/teams')
        .set(authHeader(adminToken))
        .send({ name: `Team ${Date.now()}`, description: 'test' });
      expect(res.status).toBe(201);
      teamId = res.body.data.id;
    });

    it('GET /teams lists memberships', async () => {
      const res = await request(app).get('/api/v1/teams').set(authHeader(memberToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /teams/:id', async () => {
      const res = await request(app).get(`/api/v1/teams/${teamId}`).set(authHeader(adminToken));
      expect(res.status).toBe(200);
    });

    it('PATCH /teams/:id rejects non-admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set(authHeader(memberToken))
        .send({ name: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('PATCH /teams/:id allows admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set(authHeader(adminToken))
        .send({ description: 'updated' });
      expect(res.status).toBe(200);
    });
  });

  describe('Projects', () => {
    it('adds seed member to integration team', async () => {
      const member = await prisma.user.findUnique({ where: { email: 'member@taskflow.dev' } });
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: member!.id } },
        create: { teamId, userId: member!.id, role: TeamRole.MEMBER },
        update: { role: TeamRole.MEMBER },
      });
    });

    it('POST /projects/teams/:teamId', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/teams/${teamId}`)
        .set(authHeader(adminToken))
        .send({ name: 'Integration Project' });
      expect(res.status).toBe(201);
      projectId = res.body.data.id;
    });

    it('GET /projects/teams/:teamId', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/teams/${teamId}`)
        .set(authHeader(memberToken));
      expect(res.status).toBe(200);
    });

    it('GET /projects/:projectId', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
    });

    it('POST /projects/:projectId/members', async () => {
      const member = await prisma.user.findUnique({ where: { email: 'member@taskflow.dev' } });
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .set(authHeader(adminToken))
        .send({ userId: member!.id, role: ProjectRole.DEVELOPER });
      expect(res.status).toBe(201);
    });
  });

  describe('Tasks', () => {
    it('POST /tasks/projects/:projectId', async () => {
      const member = await prisma.user.findUnique({ where: { email: 'member@taskflow.dev' } });
      const res = await request(app)
        .post(`/api/v1/tasks/projects/${projectId}`)
        .set(authHeader(adminToken))
        .send({
          title: 'Ship v1 search indexing',
          description: 'postgres full-text release checklist',
          assigneeId: member!.id,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(res.status).toBe(201);
      taskId = res.body.data.id;
    });

    it('GET /tasks/projects/:projectId', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/projects/${projectId}`)
        .set(authHeader(memberToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /tasks/projects/:projectId clamps pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/projects/${projectId}`)
        .query({ page: -1, limit: 999 })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(100);
      expect(res.body.meta.totalCount).toBeGreaterThanOrEqual(0);
      expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(0);
    });

    it('GET /tasks/search returns pagination meta', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/search')
        .query({ q: 'release' })
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.meta).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        totalCount: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('GET /tasks/:taskId', async () => {
      const res = await request(app).get(`/api/v1/tasks/${taskId}`).set(authHeader(adminToken));
      expect(res.status).toBe(200);
    });

    it('PATCH /tasks/:taskId', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set(authHeader(memberToken))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
    });

    it('POST /tasks/:taskId/comments', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set(authHeader(memberToken))
        .send({ content: 'Looks good' });
      expect(res.status).toBe(201);
    });

    it('GET /tasks/:taskId/comments', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Notifications', () => {
    it('GET /notifications', async () => {
      const res = await request(app).get('/api/v1/notifications').set(authHeader(adminToken));
      expect(res.status).toBe(200);
      if (res.body.data[0]) notificationId = res.body.data[0].id;
    });

    it('PATCH /notifications/:id/read', async () => {
      if (!notificationId) return;
      const res = await request(app)
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
    });
  });

  describe('Negative auth', () => {
    it('rejects invalid login body', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-email' });
      expect(res.status).toBe(400);
    });

    it('rejects missing token', async () => {
      const res = await request(app).get('/api/v1/teams');
      expect(res.status).toBe(401);
    });
  });
});
