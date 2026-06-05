import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { DownloadQueueService } from '../../queues/download.queue';
import { DownloadProcessorService } from '../../services/download-processor.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { PLAN_LIMITS, getHistorySince } from '@hellodownloader/shared-types';
import { PlanType, type DownloadType } from '@hellodownloader/shared-types';
import { CreateDownloadDto } from './download.dto';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);

  constructor(
    private prisma: PrismaService,
    private downloadQueue: DownloadQueueService,
    private downloadProcessor: DownloadProcessorService,
    private ytDlp: YtDlpService,
  ) {}

  async createForRequest(
    user: { id: string; plan: string } | undefined,
    dto: CreateDownloadDto,
  ) {
    if (user) {
      return this.create(user.id, user.plan as PlanType, dto);
    }
    const guest = await this.getOrCreateGuestUser();
    return this.create(guest.id, PlanType.FREE, dto);
  }

  private async getOrCreateGuestUser() {
    const email = 'guest@hellodownloader.local';
    let guest = await this.prisma.user.findUnique({ where: { email } });
    if (!guest) {
      guest = await this.prisma.user.create({
        data: {
          email,
          passwordHash: 'guest-not-used',
          name: 'Guest',
          plan: 'FREE',
        },
      });
    }
    return guest;
  }

  async create(userId: string, plan: PlanType, dto: CreateDownloadDto) {
    const limits = PLAN_LIMITS[plan];
    const quality = dto.quality ?? limits.maxResolution;
    if (quality > limits.maxResolution) {
      throw new BadRequestException(
        `Free plan limited to ${limits.maxResolution}p. Upgrade to Pro for higher quality.`,
      );
    }

    let metadata;
    try {
      metadata = await this.ytDlp.extractMetadata(dto.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not extract video metadata.';
      throw new BadRequestException(message);
    }

    const download = await this.prisma.download.create({
      data: {
        userId,
        url: dto.url,
        type: dto.type as DownloadType,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        format: dto.format,
        quality,
        status: 'QUEUED',
        metadata: metadata as object,
      },
    });

    const jobData = {
      downloadId: download.id,
      userId,
      url: dto.url,
      type: dto.type,
      format: dto.format,
      quality,
      plan,
    };

    const jobResult = await this.downloadQueue.addJob(jobData);

    if (jobResult && 'inline' in jobResult && jobResult.inline) {
      this.logger.log(`Processing download ${download.id} on server...`);
      void this.downloadProcessor.process(jobData);
    } else {
      this.logger.warn(
        `Download ${download.id} queued in Redis — run: pnpm --filter @hellodownloader/worker-download dev`,
      );
    }

    const useInline = jobResult && 'inline' in jobResult && jobResult.inline;
    return {
      ...this.serializeDownload(download),
      message: useInline
        ? 'Processing on server. Keep this page open until the download button appears.'
        : 'Queued in Redis — start worker-download or set USE_BULLMQ_DOWNLOADS=false in .env',
    };
  }

  async findAll(userId: string, plan: PlanType, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const historySince = getHistorySince(plan);
    const where = {
      userId,
      ...(historySince ? { createdAt: { gte: historySince } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.download.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.download.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      historyDays: PLAN_LIMITS[plan].historyDays,
    };
  }

  async findOne(userId: string, id: string) {
    const row = await this.prisma.download.findFirst({ where: { id, userId } });
    return row ? this.serializeDownload(row) : null;
  }

  async getStatusById(id: string) {
    const row = await this.prisma.download.findUnique({ where: { id } });
    if (!row) throw new BadRequestException('Download not found');
    return this.serializeDownload(row);
  }

  getFilePath(id: string) {
    return this.prisma.download.findUnique({
      where: { id },
      select: { id: true, filePath: true, status: true, title: true },
    });
  }

  async releaseFileAfterDelivery(id: string, filePath: string) {
    const { deleteLocalFile, shouldDeleteAfterDownload } = await import('../../utils/file-delivery');
    if (!shouldDeleteAfterDownload()) return;

    try {
      deleteLocalFile(filePath);
      await this.prisma.download.update({
        where: { id },
        data: { filePath: null, fileUrl: null },
      });
      this.logger.log(`Removed delivered file for download ${id}`);
    } catch (err) {
      this.logger.warn(
        `Failed to remove file after delivery ${id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private serializeDownload(row: {
    id: string;
    status: string;
    progress: number;
    title: string | null;
    error: string | null;
    filePath: string | null;
    fileUrl: string | null;
    fileSize: bigint | null;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    return {
      id: row.id,
      status: row.status,
      progress: row.status === 'COMPLETED' ? 100 : row.progress,
      title: row.title,
      error: row.error,
      fileSize: row.fileSize?.toString() ?? null,
      downloadUrl:
        row.status === 'COMPLETED' && row.filePath
          ? `${apiBase}/api/v1/downloads/${row.id}/file`
          : null,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  async getMetadata(url: string) {
    if (!url?.trim()) {
      throw new BadRequestException('URL is required');
    }
    try {
      return await this.ytDlp.extractMetadata(url.trim());
    } catch (err) {
      const message =
        err instanceof BadRequestException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not fetch video metadata';
      throw new BadRequestException(message);
    }
  }

  private thumbnailReferer(imageUrl: URL): string {
    const host = imageUrl.hostname;
    if (/instagram/i.test(host)) return 'https://www.instagram.com/';
    if (/facebook|fbcdn/i.test(host)) return 'https://www.facebook.com/';
    if (/tiktok/i.test(host)) return 'https://www.tiktok.com/';
    if (/twimg|twitter|x\.com/i.test(host)) return 'https://x.com/';
    return imageUrl.origin;
  }

  private isAllowedThumbnailHost(hostname: string): boolean {
    const allowed =
      /(?:^|\.)youtube\.com$|(?:^|\.)ytimg\.com$|(?:^|\.)googleusercontent\.com$|(?:^|\.)instagram\.com$|(?:^|\.)cdninstagram\.com$|(?:^|\.)fbcdn\.net$|(?:^|\.)facebook\.com$|(?:^|\.)tiktokcdn\.com$|(?:^|\.)tiktok\.com$|(?:^|\.)twimg\.com$|(?:^|\.)vimeocdn\.com$|(?:^|\.)vimeo\.com$/i;
    return allowed.test(hostname);
  }

  async proxyThumbnail(rawUrl: string, res: Response) {
    if (!rawUrl?.trim()) {
      throw new BadRequestException('Thumbnail URL is required');
    }

    let imageUrl: URL;
    try {
      imageUrl = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException('Invalid thumbnail URL');
    }

    if (imageUrl.protocol !== 'https:' || !this.isAllowedThumbnailHost(imageUrl.hostname)) {
      throw new BadRequestException('Thumbnail host is not allowed');
    }

    const upstream = await fetch(imageUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: this.thumbnailReferer(imageUrl),
        Accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      throw new NotFoundException('Thumbnail could not be loaded');
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(buffer);
  }
}
