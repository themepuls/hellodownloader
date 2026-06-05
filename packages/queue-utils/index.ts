import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { QueueName } from '@hellodownloader/shared-types';

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

/** True when BullMQ workers / Redis queues should be used (production). */
export function isRedisEnabled(): boolean {
  if (process.env.REDIS_ENABLED === 'false') return false;
  if (process.env.USE_BULLMQ_DOWNLOADS === 'true') return true;
  if (process.env.REDIS_ENABLED === 'true') return true;
  return false;
}

export function createRedisConnection(url: string): IORedis | null {
  if (!isRedisEnabled()) return null;

  const redis = new IORedis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
    enableOfflineQueue: false,
    reconnectOnError: () => false,
    enableReadyCheck: false,
    autoResubscribe: false,
    autoResendUnfulfilledCommands: false,
  });

  // Prevent "[ioredis] Unhandled error event" spam when Redis is down.
  redis.on('error', () => {});

  return redis;
}

export function createQueue(name: QueueName, connection: IORedis): Queue {
  return new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
}

export function createQueueEvents(name: QueueName, connection: IORedis): QueueEvents {
  return new QueueEvents(name, { connection });
}

export { Queue, Worker, QueueEvents, JobsOptions };
export { QueueName };
