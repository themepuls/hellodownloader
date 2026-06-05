import { Module } from '@nestjs/common';
import { ThumbnailController } from './thumbnail.controller';
import { ThumbnailService } from './thumbnail.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { CreditsModule } from '../credits/credits.module';
import { ThumbnailQueueService } from '../../queues/thumbnail.queue';

@Module({
  imports: [CreditsModule],
  controllers: [ThumbnailController],
  providers: [ThumbnailService, YtDlpService, ThumbnailQueueService],
})
export class ThumbnailModule {}
