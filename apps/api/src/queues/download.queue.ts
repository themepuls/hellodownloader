import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createQueue, createRedisConnection, isRedisEnabled } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { DownloadJobData } from '@hellodownloader/shared-types';
import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';

@Injectable()
export class DownloadQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DownloadQueueService.name);
  private connection: IORedis | null = null;
  queue: Queue<DownloadJobData> | null = null;
  redisAvailable = false;

  constructor() {
    if (!isRedisEnabled()) {
      this.logger.log('Redis disabled — downloads process inline');
      return;
    }

    try {
      this.connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
      if (!this.connection) return;

      this.connection
        .connect()
        .then(() => {
          this.redisAvailable = true;
          this.queue = createQueue(QueueName.DOWNLOAD, this.connection!);
          this.logger.log('Download queue connected to Redis');
        })
        .catch(() => {
          this.logger.warn('Redis not running — downloads will process inline');
          this.redisAvailable = false;
          this.connection?.disconnect();
          this.connection = null;
        });
    } catch {
      this.logger.warn('Redis init failed — inline download mode enabled');
    }
  }

  async addJob(data: DownloadJobData, priority = 5): Promise<{ inline: true } | ReturnType<Queue<DownloadJobData>['add']>> {
    const useQueue = process.env.USE_BULLMQ_DOWNLOADS === 'true';
    if (!useQueue || !this.queue || !this.redisAvailable) {
      return { inline: true };
    }
    const jobPriority = data.plan === 'PRO' ? 1 : priority;
    return this.queue.add('process-download', data, { priority: jobPriority });
  }

  async onModuleDestroy() {
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
