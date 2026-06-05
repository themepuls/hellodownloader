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

    await this.prisma.playlist.update({
      where: { id: data.playlistId },
      data: { status: 'PROCESSING', progress: 10 },
    });

    try {
      const maxHeight = data.plan === 'PRO' ? (data.quality ?? 1080) : Math.min(data.quality ?? 720, 720);

      const files = await this.playlistDownloader.download(data.url, outputDir, maxHeight);
      if (!files.length) throw new Error('Playlist download produced no files');

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

      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          zipPath: destPath,
          zipUrl: `/api/v1/playlists/${data.playlistId}/file`,
          itemCount: files.length,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Playlist ${data.playlistId} completed: ${destPath} (${files.length} videos)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playlist download failed';
      this.logger.error(`Playlist ${data.playlistId} failed: ${message}`);
      await this.prisma.playlist.update({
        where: { id: data.playlistId },
        data: { status: 'FAILED', error: message, progress: 0 },
      });
    }
  }
}
