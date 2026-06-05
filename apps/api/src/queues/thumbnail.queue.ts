import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createQueue, createRedisConnection, isRedisEnabled } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import type { Queue } from 'bullmq';

@Injectable()
export class ThumbnailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailQueueService.name);
  queue: Queue<ThumbnailJobData> | null = null;
  redisAvailable = false;

  constructor() {
    if (!isRedisEnabled()) return;

    try {
      const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
      if (!connection) return;

      connection
        .connect()
        .then(() => {
          this.queue = createQueue(QueueName.THUMBNAIL, connection);
          this.redisAvailable = true;
        })
        .catch(() => {
          this.logger.warn('Thumbnail queue: Redis unavailable');
          connection.disconnect();
        });
    } catch {
      this.logger.warn('Thumbnail queue disabled');
    }
  }

  async addJob(data: ThumbnailJobData) {
    if (!this.queue || !this.redisAvailable) {
      throw new Error('Thumbnail processing requires Redis and worker-thumbnail. Start Redis or run: pnpm --filter @hellodownloader/worker-thumbnail dev');
    }
    return this.queue.add('process-thumbnail', data, { priority: 2 });
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
