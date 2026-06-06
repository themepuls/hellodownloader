import { Module } from '@nestjs/common';
import { ThumbnailController } from './thumbnail.controller';
import { ThumbnailService } from './thumbnail.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { CreditsModule } from '../credits/credits.module';
import { ThumbnailQueueService } from '../../queues/thumbnail.queue';
import { ThumbnailProcessorService } from '../../services/thumbnail-processor.service';
import { ThumbnailImageService } from '../../services/thumbnail-image.service';

import { ThumbnailHeadlineService } from './thumbnail-headline.service';

@Module({
  imports: [CreditsModule],
  controllers: [ThumbnailController],
  providers: [
    ThumbnailService,
    ThumbnailHeadlineService,
    YtDlpService,
    ThumbnailQueueService,
    ThumbnailProcessorService,
    ThumbnailImageService,
  ],
})
export class ThumbnailModule {}
