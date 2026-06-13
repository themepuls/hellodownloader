import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { ZipService } from '../../services/zip.service';
import { PlaylistProcessorService } from '../../services/playlist-processor.service';
import { PlaylistDownloader } from '../../download-engine/playlists/playlist-downloader';
import { DownloadQueueService } from '../../queues/download.queue';

@Module({
  controllers: [PlaylistController],
  providers: [
    PlaylistService,
    PlaylistProcessorService,
    PlaylistDownloader,
    YtDlpService,
    ZipService,
    DownloadQueueService,
  ],
})
export class PlaylistModule {}
