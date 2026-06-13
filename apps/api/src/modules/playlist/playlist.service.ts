import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DownloadQueueService } from '../../queues/download.queue';
import { PlaylistProcessorService } from '../../services/playlist-processor.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { PLAN_LIMITS } from '@hellodownloader/shared-types';
import { DownloadType, type PlanType } from '@hellodownloader/shared-types';
import { existsSync } from 'fs';
import * as path from 'path';
import { deliverLocalFile } from '../../utils/file-delivery';
import { StorageService } from '../../services/storage.service';
import { fromR2Reference, isR2Reference } from '../../utils/r2-storage';
import { assertSafeVideoUrl } from '../../utils/safe-url';

@Injectable()
export class PlaylistService {
  private readonly logger = new Logger(PlaylistService.name);

  constructor(
    private prisma: PrismaService,
    private downloadQueue: DownloadQueueService,
    private playlistProcessor: PlaylistProcessorService,
    private ytDlp: YtDlpService,
    private storage: StorageService,
  ) {}

  async create(userId: string, plan: PlanType, url: string, quality?: number) {
    if (!PLAN_LIMITS[plan].playlistZip) {
      throw new BadRequestException('Playlist export is not available on your plan');
    }

    const safeUrl = assertSafeVideoUrl(url);
    const maxQuality = Math.min(quality ?? PLAN_LIMITS[plan].maxResolution, PLAN_LIMITS[plan].maxResolution);

    let title: string | undefined;
    try {
      const meta = await this.ytDlp.extractMetadata(safeUrl);
      title = meta.title;
    } catch {
      title = undefined;
    }

    const playlist = await this.prisma.playlist.create({
      data: { userId, url: safeUrl, status: 'QUEUED', title },
    });

    const jobData = {
      downloadId: playlist.id,
      userId,
      url: safeUrl,
      type: DownloadType.PLAYLIST,
      plan,
      quality: maxQuality,
    };

    const jobResult = await this.downloadQueue.addJob(jobData);

    if (jobResult && 'inline' in jobResult && jobResult.inline) {
      this.logger.log(`Processing playlist ${playlist.id} on server...`);
      void this.playlistProcessor.process({
        playlistId: playlist.id,
        userId,
        url: safeUrl,
        plan,
        quality: maxQuality,
      });
    }

    return {
      ...playlist,
      message: 'Processing playlist on server. Keep this page open until the download button appears.',
    };
  }

  async findAll(userId: string) {
    return this.prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatus(userId: string, id: string) {
    const playlist = await this.prisma.playlist.findFirst({ where: { id, userId } });
    if (!playlist) throw new ForbiddenException('Playlist not found');
    return playlist;
  }

  async getFileForUser(userId: string, id: string) {
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, userId },
    });
    if (!playlist || playlist.status !== 'COMPLETED') {
      throw new BadRequestException('ZIP not ready yet');
    }
    if (!playlist.zipPath) {
      throw new BadRequestException(
        'File no longer on server (already saved or expired). Start a new download from the playlist page.',
      );
    }
    if (!isR2Reference(playlist.zipPath) && !existsSync(playlist.zipPath)) {
      throw new BadRequestException(
        'File no longer on server (already saved or expired). Start a new download from the playlist page.',
      );
    }
    return playlist;
  }

  async getFileStream(filePath: string) {
    const filename = path.basename(fromR2Reference(filePath));
    const safeName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    if (isR2Reference(filePath)) {
      const { body } = await this.storage.openR2Object(fromR2Reference(filePath));
      return { stream: body, filename, safeName };
    }
    return {
      stream: deliverLocalFile(filePath),
      filename,
      safeName,
    };
  }

  async releaseZipAfterDelivery(playlistId: string, zipPath: string) {
    const { deleteLocalFile, shouldDeleteAfterDownload } = await import('../../utils/file-delivery');
    if (!shouldDeleteAfterDownload()) return;

    try {
      if (isR2Reference(zipPath)) {
        this.logger.log(`Playlist ${playlistId} kept on R2 (${fromR2Reference(zipPath)})`);
        return;
      }
      deleteLocalFile(zipPath);
      await this.prisma.playlist.update({
        where: { id: playlistId },
        data: { zipPath: null, zipUrl: null },
      });
      this.logger.log(`Removed delivered local ZIP for playlist ${playlistId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to remove ZIP after delivery ${playlistId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
