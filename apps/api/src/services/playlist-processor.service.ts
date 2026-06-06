import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlaylistDownloader } from '../download-engine/playlists/playlist-downloader';
import { ZipService } from './zip.service';
import type { PlanType } from '@hellodownloader/shared-types';
import * as fs from 'fs';
import * as path from 'path';

export interface PlaylistJobData {
  playlistId: string;
  userId: string;
  url: string;
  plan: PlanType;
  quality?: number;
}

function countMediaFiles(outputDir: string): number {
  if (!fs.existsSync(outputDir)) return 0;
  return fs.readdirSync(outputDir).filter((f) => !f.startsWith('.') && /\.(mp4|webm|mkv|m4a|mp3)$/i.test(f))
    .length;
}

@Injectable()
export class PlaylistProcessorService {
  private readonly logger = new Logger(PlaylistProcessorService.name);
  private readonly storagePath = process.env.STORAGE_PATH ?? './storage';

  constructor(
    private prisma: PrismaService,
    private playlistDownloader: PlaylistDownloader,
    private zipService: ZipService,
  ) {}

  async process(data: PlaylistJobData) {
    const outputDir = path.join(this.storagePath, 'temp', data.playlistId);
    fs.mkdirSync(outputDir, { recursive: true });

    const totalVideos = await this.playlistDownloader.getEntryCount(data.url);
    const expectedTotal = totalVideos;
    let lastReportedProgress = 10;
    let lastItemCount = 0;
    let progressTimer: ReturnType<typeof setTimeout> | null = null;

    const flushProgress = async (progress: number) => {
      lastReportedProgress = Math.max(lastReportedProgress, progress);
      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: {
          progress: lastReportedProgress,
          status: 'PROCESSING',
        },
      });
    };

    const scheduleProgress = (progress: number) => {
      if (progress <= lastReportedProgress) return;
      if (progressTimer) clearTimeout(progressTimer);
      progressTimer = setTimeout(() => {
        void flushProgress(progress);
      }, 400);
    };

    await this.prisma.playlist.update({
      where: { id: data.playlistId },
      data: {
        status: 'PROCESSING',
        progress: 10,
        ...(totalVideos ? { itemCount: totalVideos } : {}),
      },
    });

    const filePoll = setInterval(() => {
      const count = countMediaFiles(outputDir);
      if (count <= lastItemCount) return;
      lastItemCount = count;
      const total = totalVideos ?? count;
      const estimated =
        total > 0 ? 10 + Math.round((count / total) * 75) : Math.min(80, 10 + count * 3);
      scheduleProgress(estimated);
    }, 15_000);

    try {
      const maxHeight = data.plan === 'PRO' ? (data.quality ?? 1080) : Math.min(data.quality ?? 720, 720);

      const files = await this.playlistDownloader.download(data.url, outputDir, {
        maxHeight,
        onProgress: (percent) => scheduleProgress(percent),
        onItemsProgress: (completed, total) => {
          if (completed > lastItemCount) lastItemCount = completed;
          const totalItems = total ?? totalVideos;
          scheduleProgress(
            totalItems && totalItems > 0
              ? 10 + Math.round((completed / totalItems) * 75)
              : lastReportedProgress + 1,
          );
        },
      });
      if (!files.length) throw new Error('Playlist download produced no files');

      if (progressTimer) clearTimeout(progressTimer);
      clearInterval(filePoll);

      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: { progress: 85, itemCount: files.length },
      });

      let primaryFilePath: string;
      if (files.length > 1) {
        const zipPath = path.join(outputDir, `playlist-${data.playlistId}.zip`);
        primaryFilePath = await this.zipService.createZip(files, zipPath);
      } else {
        primaryFilePath = files[0];
      }

      const userFolder = data.plan === 'PRO' ? 'pro-users' : 'free-users';
      const destDir = path.join(this.storagePath, 'playlists', userFolder, data.userId);
      fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, path.basename(primaryFilePath));
      if (primaryFilePath !== destPath) fs.renameSync(primaryFilePath, destPath);

      const skipped =
        expectedTotal && expectedTotal > files.length ? expectedTotal - files.length : 0;
      const skipNotice =
        skipped > 0
          ? `${skipped} video(s) were skipped (private, deleted, or unavailable). Downloaded ${files.length}.`
          : null;

      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          zipPath: destPath,
          zipUrl: `/api/v1/playlists/${data.playlistId}/file`,
          itemCount: files.length,
          error: skipNotice,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Playlist ${data.playlistId} completed: ${destPath} (${files.length} videos)`);
    } catch (err) {
      if (progressTimer) clearTimeout(progressTimer);
      clearInterval(filePoll);
      const message = err instanceof Error ? err.message : 'Playlist download failed';
      this.logger.error(`Playlist ${data.playlistId} failed: ${message}`);
      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: { status: 'FAILED', error: message, progress: 0 },
      });
    }
  }
}
