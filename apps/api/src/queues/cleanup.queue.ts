import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createQueue, createRedisConnection, isRedisEnabled } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { Queue } from 'bullmq';
import { StorageService } from '../services/storage.service';

@Injectable()
export class CleanupQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CleanupQueueService.name);
  private queue: Queue | null = null;

  constructor(private storage: StorageService) {
    if (!isRedisEnabled()) return;

    try {
      const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
      if (!connection) return;

      connection
        .connect()
        .then(() => {
          this.queue = createQueue(QueueName.CLEANUP, connection);
        })
        .catch(() => {
          this.logger.warn('Cleanup queue: Redis unavailable — using inline cleanup');
          connection.disconnect();
        });
    } catch {
      this.logger.warn('Cleanup queue disabled');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleCleanup() {
    const hours = parseInt(process.env.FILE_RETENTION_HOURS ?? '24', 10);
    if (this.queue) {
      await this.queue.add('cleanup-files', { retentionHours: hours });
    } else {
      const removed = await this.storage.cleanupOlderThan(hours);
      this.logger.log(`Inline cleanup removed ${removed} files`);
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
