import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { FfmpegService } from '../../services/ffmpeg.service';
import { ZipService } from '../../services/zip.service';
import { DownloadProcessorService } from '../../services/download-processor.service';
import { YouTubeDownloader } from '../../download-engine/youtube/youtube-downloader';
import { FacebookDownloader } from '../../download-engine/facebook/facebook-downloader';
import { InstagramDownloader } from '../../download-engine/instagram/instagram-downloader';
import { SubtitleDownloader } from '../../download-engine/subtitles/subtitle-downloader';
import { PlaylistDownloader } from '../../download-engine/playlists/playlist-downloader';
import { Mp3Converter } from '../../download-engine/audio/mp3-converter';
import { MetadataExtractor } from '../../download-engine/metadata/metadata-extractor';

@Module({
  controllers: [DownloadController],
  providers: [
    DownloadService,
    DownloadProcessorService,
    YtDlpService,
    FfmpegService,
    ZipService,
    YouTubeDownloader,
    FacebookDownloader,
    InstagramDownloader,
    SubtitleDownloader,
    PlaylistDownloader,
    Mp3Converter,
    MetadataExtractor,
  ],
  exports: [DownloadService, DownloadProcessorService],
})
export class DownloadModule {}
