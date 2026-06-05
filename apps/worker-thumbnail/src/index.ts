import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import { processThumbnail } from './process-thumbnail';

const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');

new Worker<ThumbnailJobData>(
  QueueName.THUMBNAIL,
  async (job) => processThumbnail(job.data),
  { connection, concurrency: 2 },
);

console.log('[thumbnail-worker] Started');
