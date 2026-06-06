import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createQueue, createRedisConnection, isRedisEnabled } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';

@Injectable()
export class ThumbnailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ThumbnailQueueService.name);
  private connection: IORedis | null = null;
  queue: Queue<ThumbnailJobData> | null = null;
  redisAvailable = false;

  constructor() {
    if (!isRedisEnabled()) {
      this.logger.log('Redis disabled — thumbnails process inline');
      return;
    }

    try {
      this.connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
      if (!this.connection) return;

      this.connection
        .connect()
        .then(() => {
          this.redisAvailable = true;
          this.queue = createQueue(QueueName.THUMBNAIL, this.connection!);
          this.logger.log('Thumbnail queue connected to Redis');
        })
        .catch(() => {
          this.logger.warn('Redis not running — thumbnails will process inline');
          this.redisAvailable = false;
          this.connection?.disconnect();
          this.connection = null;
        });
    } catch {
      this.logger.warn('Thumbnail queue init failed — inline mode enabled');
    }
  }

  async addJob(
    data: ThumbnailJobData,
  ): Promise<{ inline: true } | ReturnType<Queue<ThumbnailJobData>['add']>> {
    const useQueue = process.env.USE_BULLMQ_THUMBNAILS === 'true';
    if (!useQueue || !this.queue || !this.redisAvailable) {
      return { inline: true };
    }
    return this.queue.add('process-thumbnail', data, { priority: 2 });
  }

  async onModuleDestroy() {
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
