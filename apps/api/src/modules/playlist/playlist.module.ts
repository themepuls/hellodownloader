import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { AuthModule } from '../auth/auth.module';
import { YtDlpService } from '../../services/yt-dlp.service';
import { StorageService } from '../../services/storage.service';
import { ZipService } from '../../services/zip.service';
import { PlaylistProcessorService } from '../../services/playlist-processor.service';
import { PlaylistDownloader } from '../../download-engine/playlists/playlist-downloader';
import { DownloadQueueService } from '../../queues/download.queue';

@Module({
  imports: [AuthModule],
  controllers: [PlaylistController],
  providers: [
    PlaylistService,
    PlaylistProcessorService,
    PlaylistDownloader,
    YtDlpService,
    StorageService,
    ZipService,
    DownloadQueueService,
  ],
})
export class PlaylistModule {}
