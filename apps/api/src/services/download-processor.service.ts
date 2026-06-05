import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { YtDlpService } from './yt-dlp.service';
import { ZipService } from './zip.service';
import { YouTubeDownloader } from '../download-engine/youtube/youtube-downloader';
import { FacebookDownloader } from '../download-engine/facebook/facebook-downloader';
import { InstagramDownloader } from '../download-engine/instagram/instagram-downloader';
import { SubtitleDownloader } from '../download-engine/subtitles/subtitle-downloader';
import { PlaylistDownloader } from '../download-engine/playlists/playlist-downloader';
import { Mp3Converter } from '../download-engine/audio/mp3-converter';
import { MetadataExtractor } from '../download-engine/metadata/metadata-extractor';
import { detectPlatform, isReelUrl, type DownloadJobData } from '@hellodownloader/shared-types';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DownloadProcessorService {
  private readonly logger = new Logger(DownloadProcessorService.name);
  private readonly storagePath = process.env.STORAGE_PATH ?? './storage';

  constructor(
    private prisma: PrismaService,
    private ytDlp: YtDlpService,
    private youTubeDownloader: YouTubeDownloader,
    private facebookDownloader: FacebookDownloader,
    private instagramDownloader: InstagramDownloader,
    private subtitleDownloader: SubtitleDownloader,
    private playlistDownloader: PlaylistDownloader,
    private mp3Converter: Mp3Converter,
    private metadataExtractor: MetadataExtractor,
    private zipService: ZipService,
  ) {}

  async process(data: DownloadJobData) {
    const outputDir = path.join(this.storagePath, 'temp', data.downloadId);
    fs.mkdirSync(outputDir, { recursive: true });

    await this.prisma.download.update({
      where: { id: data.downloadId },
      data: { status: 'PROCESSING', progress: 10 },
    });

    try {
      const maxHeight =
        data.plan === 'PRO' ? (data.quality ?? 1080) : Math.min(data.quality ?? 720, 720);

      const existing = await this.prisma.download.findUnique({
        where: { id: data.downloadId },
        select: { metadata: true },
      });
      const durationSeconds =
        (existing?.metadata as { duration?: number } | null)?.duration ?? undefined;

      let lastReportedProgress = 10;
      let progressTimer: ReturnType<typeof setTimeout> | null = null;

      const flushProgress = async (percent: number) => {
        lastReportedProgress = Math.max(lastReportedProgress, percent);
        await this.prisma.download.update({
          where: { id: data.downloadId },
          data: { progress: lastReportedProgress, status: 'PROCESSING' },
        });
      };

      const onProgress = (percent: number) => {
        if (percent <= lastReportedProgress) return;
        lastReportedProgress = percent;
        if (progressTimer) clearTimeout(progressTimer);
        progressTimer = setTimeout(() => {
          void flushProgress(percent);
        }, 400);
      };

      const downloadOpts = { onProgress, durationSeconds };
      const platform = detectPlatform(data.url);
      let primaryFilePath: string;

      // Route to correct downloader based on type and platform
      if (data.type === 'MP3') {
        primaryFilePath = await this.mp3Converter.convert(data.url, outputDir, downloadOpts);
      } else if (data.type === 'SUBTITLE') {
        const files = await this.subtitleDownloader.download(data.url, outputDir);
        primaryFilePath = files[0];
      } else if (data.type === 'PLAYLIST') {
        const files = await this.playlistDownloader.download(data.url, outputDir, maxHeight);
        if (files.length > 1) {
          const zipPath = path.join(outputDir, `playlist-${data.downloadId}.zip`);
          primaryFilePath = await this.zipService.createZip(files, zipPath);
        } else {
          primaryFilePath = files[0];
        }
      } else if (data.type === 'REEL_FACEBOOK' || platform === 'facebook') {
        primaryFilePath = await this.facebookDownloader.download(data.url, {
          type: isReelUrl(data.url, platform) ? 'REEL_FACEBOOK' : 'VIDEO',
          quality: maxHeight,
          outputDir,
        });
      } else if (data.type === 'REEL_INSTAGRAM' || platform === 'instagram') {
        primaryFilePath = await this.instagramDownloader.download(data.url, {
          type: isReelUrl(data.url, platform) ? 'REEL_INSTAGRAM' : 'VIDEO',
          quality: maxHeight,
          outputDir,
        });
      } else {
        // VIDEO, SHORTS, TikTok, Twitter/X, Vimeo, and other yt-dlp-supported sites
        primaryFilePath = await this.ytDlp.downloadVideo(data.url, outputDir, {
          maxHeight: maxHeight,
          format: data.format,
          ...downloadOpts,
        });
      }

      if (progressTimer) clearTimeout(progressTimer);
      await flushProgress(85);

      const stat = fs.statSync(primaryFilePath);
      const userFolder = data.plan === 'PRO' ? 'pro-users' : 'free-users';
      const destDir = path.join(this.storagePath, 'downloads', userFolder, data.userId);
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, path.basename(primaryFilePath));
      if (primaryFilePath !== destPath) fs.renameSync(primaryFilePath, destPath);

      await this.prisma.download.update({
        where: { id: data.downloadId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          filePath: destPath,
          fileUrl: `/api/v1/downloads/${data.downloadId}/file`,
          fileSize: BigInt(stat.size),
          completedAt: new Date(),
        },
      });

      this.logger.log(`Download ${data.downloadId} completed: ${destPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      this.logger.error(`Download ${data.downloadId} failed: ${message}`);
      await this.prisma.download.update({
        where: { id: data.downloadId },
        data: { status: 'FAILED', error: message, progress: 0 },
      });
    }
  }
}
