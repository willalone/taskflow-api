import 'dotenv/config';
import { registerWorkers, scheduleRecurringJobs } from './modules/queue/notifications.queue.js';
import { logger } from './shared/lib/logger.js';
import { prisma } from './shared/lib/prisma.js';

async function main() {
  await prisma.$connect();
  registerWorkers();
  await scheduleRecurringJobs();
  logger.info('TaskFlow worker started');
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
