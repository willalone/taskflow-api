import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './shared/lib/logger.js';
import { prisma } from './shared/lib/prisma.js';

const env = loadEnv();
const app = createApp();

async function main() {
  await prisma.$connect();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'TaskFlow API started');
  });
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
