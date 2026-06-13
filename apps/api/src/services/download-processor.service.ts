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
import { getThumbnailRetentionCount, removeEmptyDirs, removePathRecursive } from '../utils/fs-utils';
import { StorageService } from './storage.service';

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
    private storage: StorageService,
  ) {}

  async process(data: DownloadJobData) {
    const outputDir = path.join(this.storagePath, 'temp', data.downloadId);
    fs.mkdirSync(outputDir, { recursive: true });

    await this.prisma.download.update({
      where: { id: data.downloadId },
      data: { status: 'PROCESSING', progress: 10 },
    });

    let progressTimer: ReturnType<typeof setTimeout> | null = null;

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

      const downloadOpts = { onProgress, durationSeconds, url: data.url };
      const platform = detectPlatform(data.url);
      let primaryFilePath: string;

      // Route to correct downloader based on type and platform
      if (data.type === 'MP3') {
        primaryFilePath = await this.mp3Converter.convert(data.url, outputDir, downloadOpts);
      } else if (data.type === 'SUBTITLE') {
        const files = await this.subtitleDownloader.download(data.url, outputDir);
        primaryFilePath = files[0];
      } else if (data.type === 'PLAYLIST') {
        const files = await this.playlistDownloader.download(data.url, outputDir, {
          maxHeight,
          onProgress,
        });
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
          format: data.format,
          outputDir,
          onProgress,
          durationSeconds,
        });
      } else if (data.type === 'REEL_INSTAGRAM' || platform === 'instagram') {
        primaryFilePath = await this.instagramDownloader.download(data.url, {
          type: isReelUrl(data.url, platform) ? 'REEL_INSTAGRAM' : 'VIDEO',
          quality: maxHeight,
          format: data.format,
          outputDir,
          onProgress,
          durationSeconds,
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
      const requestedQuality = data.type === 'VIDEO' ? (data.quality ?? null) : null;
      let actualHeight: number | null = null;
      let qualityWarning: string | null = null;

      if (data.type === 'VIDEO') {
        actualHeight = await this.ytDlp.probeVideoResolution(primaryFilePath);
        if (
          requestedQuality &&
          actualHeight &&
          actualHeight < Math.floor(requestedQuality * 0.85)
        ) {
          qualityWarning = `Downloaded at ${actualHeight}p (${Math.round(stat.size / 1_048_576)} MB) — ${requestedQuality}p was not available from the source. Try again or pick another quality.`;
        }
      }

      const priorMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};

      const userFolder = data.plan === 'PRO' ? 'pro-users' : 'free-users';
      const destDir = path.join(this.storagePath, 'downloads', userFolder, data.userId);
      fs.mkdirSync(destDir, { recursive: true });
      const ext = path.extname(primaryFilePath) || (data.type === 'MP3' ? '.mp3' : '.mp4');
      const destPath = path.join(destDir, `${data.downloadId}${ext}`);
      if (primaryFilePath !== destPath) fs.renameSync(primaryFilePath, destPath);
      const r2Key = `downloads/${userFolder}/${data.userId}/${data.downloadId}${ext}`;

      await this.prisma.download.update({
        where: { id: data.downloadId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          filePath: destPath,
          fileUrl: `/api/v1/downloads/${data.downloadId}/file`,
          fileSize: BigInt(stat.size),
          completedAt: new Date(),
          metadata: {
            ...priorMeta,
            actualHeight,
            requestedQuality,
            qualityWarning,
          },
        },
      });

      this.logger.log(`Download ${data.downloadId} ready locally: ${destPath}`);
      this.storage.scheduleBackgroundR2Persist(destPath, r2Key, async (storedPath) => {
        await this.prisma.download.update({
          where: { id: data.downloadId },
          data: { filePath: storedPath },
        });
        this.logger.log(`Download ${data.downloadId} mirrored to R2: ${storedPath}`);
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Download failed';
      const message =
        raw.trim() && raw !== 'undefined' && raw !== 'null' ? raw.trim() : 'Download failed';
      this.logger.error(`Download ${data.downloadId} failed: ${message}`);
      await this.prisma.download.update({
        where: { id: data.downloadId },
        data: { status: 'FAILED', error: message, progress: 0 },
      });
    } finally {
      if (progressTimer) clearTimeout(progressTimer);
      removePathRecursive(outputDir);
    }
  }
}
