import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createQueue, createRedisConnection, isRedisEnabled } from '@hellodownloader/queue-utils';
import { QueueName } from '@hellodownloader/shared-types';
import type { Queue } from 'bullmq';

export interface VideoJobData {
  downloadId: string;
  inputPath: string;
  operation: 'mp3' | 'merge';
}

@Injectable()
export class VideoQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoQueueService.name);
  queue: Queue<VideoJobData> | null = null;

  constructor() {
    if (!isRedisEnabled()) return;

    try {
      const connection = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
      if (!connection) return;

      connection
        .connect()
        .then(() => {
          this.queue = createQueue(QueueName.VIDEO, connection);
        })
        .catch(() => {
          this.logger.warn('Video queue: Redis unavailable');
          connection.disconnect();
        });
    } catch {
      this.logger.warn('Video queue disabled');
    }
  }

  async addJob(data: VideoJobData) {
    if (!this.queue) throw new Error('Video queue requires Redis');
    return this.queue.add('process-video', data);
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
