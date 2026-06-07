import { Global, Module } from '@nestjs/common';
import { DownloadQueueService } from './download.queue';
import { ThumbnailQueueService } from './thumbnail.queue';
import { VideoQueueService } from './video.queue';
import { CleanupQueueService } from './cleanup.queue';
import { StorageService } from '../services/storage.service';
import { StorageSettingsModule } from '../modules/storage-settings/storage-settings.module';

@Global()
@Module({
  imports: [StorageSettingsModule],
  providers: [
    StorageService,
    DownloadQueueService,
    ThumbnailQueueService,
    VideoQueueService,
    CleanupQueueService,
  ],
  exports: [
    StorageService,
    DownloadQueueService,
    ThumbnailQueueService,
    VideoQueueService,
    CleanupQueueService,
  ],
})
export class QueueModule {}
