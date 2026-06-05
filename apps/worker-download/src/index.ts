import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { DownloadJobData } from '@hellodownloader/shared-types';
import { processDownload } from './process-download';

const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');

const worker = new Worker<DownloadJobData>(
  QueueName.DOWNLOAD,
  async (job) => {
    console.log(`[download-worker] Processing job ${job.id}`);
    await processDownload(job.data);
  },
  { connection, concurrency: 3 },
);

worker.on('completed', (job) => console.log(`[download-worker] Completed ${job.id}`));
worker.on('failed', (job, err) => console.error(`[download-worker] Failed ${job?.id}:`, err));

console.log('[download-worker] Started');
