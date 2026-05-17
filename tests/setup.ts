import 'dotenv/config';
import { afterAll } from 'vitest';
import { prisma } from '../src/shared/lib/prisma.js';

process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX ?? '1000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '1000';

afterAll(async () => {
  await prisma.$disconnect();
});
