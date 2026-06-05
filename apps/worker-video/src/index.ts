import 'dotenv/config';
import { Worker } from 'bullmq';
import { createRedisConnection } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import { processVideo, VideoJobData } from './process-video';

const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');

new Worker<VideoJobData>(
  QueueName.VIDEO,
  async (job) => {
    console.log(`[video-worker] Processing job ${job.id}: ${job.data.operation}`);
    await processVideo(job.data);
  },
  { connection, concurrency: 2 },
);

console.log('[video-worker] Started — listening for video processing jobs');
