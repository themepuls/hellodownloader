import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { DownloadQueueService } from '../../queues/download.queue';
import { DownloadProcessorService } from '../../services/download-processor.service';
import { StorageService } from '../../services/storage.service';
import { isR2Reference, fromR2Reference } from '../../utils/r2-storage';
import { YtDlpService } from '../../services/yt-dlp.service';
import { PLAN_LIMITS, effectivePlan, getHistorySince, hasProAccess, isQualityAccessible } from '@hellodownloader/shared-types';
import { PlanType, type DownloadType } from '@hellodownloader/shared-types';
import { CreateDownloadDto } from './download.dto';
import { adminRuntimeConfig } from '../admin/admin-config';
import {
  generateResourceAccessToken,
  hashResourceAccessToken,
  readAccessTokenHash,
  verifyResourceAccessToken,
  withAccessTokenHash,
} from '../../utils/resource-access';
import { assertAllowedThumbnailUrl, assertSafeVideoUrl } from '../../utils/safe-url';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);

  constructor(
    private prisma: PrismaService,
    private downloadQueue: DownloadQueueService,
    private downloadProcessor: DownloadProcessorService,
    private ytDlp: YtDlpService,
    private storage: StorageService,
  ) {}

  async createForRequest(
    user: { id: string; plan: string; role?: string } | undefined,
    dto: CreateDownloadDto,
  ) {
    if (user) {
      const plan = effectivePlan(user.plan, user.role) as PlanType;
      return this.create(user.id, plan, dto, user.role);
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

  async create(userId: string, plan: PlanType, dto: CreateDownloadDto, role?: string) {
    const safeUrl = assertSafeVideoUrl(dto.url);
    const limits = PLAN_LIMITS[plan];
    const quality =
      dto.type === 'VIDEO' || dto.type === 'REEL_FACEBOOK' || dto.type === 'REEL_INSTAGRAM'
        ? (dto.quality ?? limits.maxResolution)
        : (dto.quality ?? undefined);
    const proAccess = hasProAccess(plan, role);
    const qualityAccess = adminRuntimeConfig.getDownloadQualityAccess();

    if (dto.type === 'VIDEO' && quality) {
      if (!isQualityAccessible(quality, qualityAccess, proAccess)) {
        throw new BadRequestException(
          'This quality is not available on your plan. Check Admin settings or upgrade to Pro.',
        );
      }
    } else if (dto.type === 'VIDEO' && quality && quality > limits.maxResolution) {
      throw new BadRequestException(
        `Free plan limited to ${limits.maxResolution}p. Upgrade to Pro for higher quality.`,
      );
    }

    let metadata;
    if (dto.metadata?.title && dto.metadata?.thumbnail) {
      const safeThumbnail = assertAllowedThumbnailUrl(dto.metadata.thumbnail);
      metadata = {
        id: dto.metadata.id ?? '',
        title: dto.metadata.title,
        thumbnail: safeThumbnail,
        thumbnailWidth: 480,
        thumbnailHeight: 360,
        duration: dto.metadata.duration ?? 0,
        uploader: dto.metadata.uploader ?? 'Unknown',
        formats: dto.metadata.formats ?? [],
      };
    } else {
      try {
        metadata = await this.ytDlp.extractMetadata(safeUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not extract video metadata.';
        throw new BadRequestException(message);
      }
    }

    const accessToken = generateResourceAccessToken();
    const accessTokenHash = hashResourceAccessToken(accessToken);

    const download = await this.prisma.download.create({
      data: {
        userId,
        url: safeUrl,
        type: dto.type as DownloadType,
        title: metadata.title,
        thumbnail: metadata.thumbnail,
        format: dto.format,
        quality,
        status: 'QUEUED',
        metadata: withAccessTokenHash(metadata as Record<string, unknown>, accessTokenHash) as object,
      },
    });

    const jobData = {
      downloadId: download.id,
      userId,
      url: safeUrl,
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
      accessToken,
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

  async assertDownloadAccess(
    id: string,
    opts: { userId?: string; accessToken?: string },
  ) {
    const row = await this.prisma.download.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Download not found');

    if (opts.userId && row.userId === opts.userId) {
      return row;
    }

    const storedHash = readAccessTokenHash(row.metadata);
    if (verifyResourceAccessToken(storedHash, opts.accessToken)) {
      return row;
    }

    throw new ForbiddenException('Access denied');
  }

  async getStatusById(id: string, opts: { userId?: string; accessToken?: string } = {}) {
    const row = await this.assertDownloadAccess(id, opts);
    return this.serializeDownload(row);
  }

  async getFilePath(
    id: string,
    opts: { userId?: string; accessToken?: string } = {},
  ) {
    const row = await this.assertDownloadAccess(id, opts);
    return {
      id: row.id,
      filePath: row.filePath,
      status: row.status,
      title: row.title,
      type: row.type,
    };
  }

  async releaseStoredFile(id: string, filePath: string) {
    const { deleteLocalFile } = await import('../../utils/file-delivery');

    try {
      if (isR2Reference(filePath)) {
        // Keep Cloudflare copy for dashboard re-download; local server file is already gone.
        this.logger.log(`Download ${id} kept on R2 (${fromR2Reference(filePath)})`);
        return;
      }
      deleteLocalFile(filePath);
      await this.prisma.download.update({
        where: { id },
        data: { filePath: null, fileUrl: null },
      });
      this.logger.log(`Released local file for download ${id}`);
    } catch (err) {
      this.logger.warn(
        `Failed to release stored file ${id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** @deprecated Use releaseStoredFile — kept for explicit opt-in via env. */
  async releaseFileAfterDelivery(id: string, filePath: string) {
    const { shouldDeleteAfterDownload } = await import('../../utils/file-delivery');
    if (!shouldDeleteAfterDownload()) return;
    await this.releaseStoredFile(id, filePath);
  }

  private serializeDownload(row: {
    id: string;
    status: string;
    progress: number;
    type?: string;
    quality?: number | null;
    title: string | null;
    error: string | null;
    filePath: string | null;
    fileUrl: string | null;
    fileSize: bigint | null;
    metadata?: unknown;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    const meta = row.metadata as {
      actualHeight?: number;
      qualityWarning?: string;
    } | null;
    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    return {
      id: row.id,
      status: row.status,
      type: row.type ?? 'VIDEO',
      quality: row.quality ?? null,
      actualHeight: meta?.actualHeight ?? null,
      progress: row.status === 'COMPLETED' ? 100 : row.progress,
      title: row.title,
      error: row.status === 'FAILED' ? row.error : null,
      warning: row.status === 'COMPLETED' ? (meta?.qualityWarning ?? null) : null,
      fileSize: row.fileSize?.toString() ?? null,
      downloadUrl:
        row.status === 'COMPLETED' && row.filePath
          ? `${apiBase}/api/v1/downloads/${row.id}/file`
          : null,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  getQualityAccess() {
    return adminRuntimeConfig.getDownloadQualityAccess();
  }

  async getMetadata(url: string) {
    const safeUrl = assertSafeVideoUrl(url);
    try {
      return await this.ytDlp.extractMetadata(safeUrl);
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

  async proxyThumbnail(rawUrl: string, res: Response) {
    const safeUrl = assertAllowedThumbnailUrl(rawUrl);
    const imageUrl = new URL(safeUrl);

    const upstream = await fetch(safeUrl, {
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

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    });

    if (upstream.body) {
      const { Readable } = await import('stream');
      const { pipeline } = await import('stream/promises');
      await pipeline(Readable.fromWeb(upstream.body as import('stream/web').ReadableStream), res);
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  }
}
