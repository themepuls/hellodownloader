import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import { cleanupFiles } from './cleanup-files';

const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');

new Worker(
  QueueName.CLEANUP,
  async (job) => {
    const hours = job.data.retentionHours ?? 24;
    const removed = await cleanupFiles(hours);
    console.log(`[cleanup-worker] Removed ${removed} files older than ${hours}h`);
  },
  { connection },
);

console.log('[cleanup-worker] Started');
