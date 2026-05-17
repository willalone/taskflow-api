import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/shared/lib/prisma.js';

export async function login(app: Express, email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data as { accessToken: string; refreshToken: string };
}

export async function registerAndActivate(
  app: Express,
  email: string,
  password: string,
  name: string,
) {
  await request(app).post('/api/v1/auth/register').send({ email, password, name });
  await prisma.user.update({ where: { email }, data: { isActive: true } });
  return login(app, email, password);
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
