import 'dotenv/config';
import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/shared/lib/prisma.js';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await prisma.$disconnect();
});
