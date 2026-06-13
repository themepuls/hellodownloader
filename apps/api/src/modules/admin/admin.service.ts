import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { adminRuntimeConfig } from './admin-config';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { DownloadProcessorService } from '../../services/download-processor.service';
import { DownloadQueueService } from '../../queues/download.queue';
import { StorageService } from '../../services/storage.service';
import { hashPassword } from '@hellodownloader/auth-utils';
import { PLAN_LIMITS, CREDIT_COSTS, PlanType, type DownloadType, type HdQualityAccessConfig } from '@hellodownloader/shared-types';
import { deleteLocalFile } from '../../utils/file-delivery';
import { PaymentConfigService } from '../../payment/payment-config.service';
import { AiApiSettingsService } from '../ai-api-settings/ai-api-settings.service';
import { FourKInterestService } from '../survey/four-k-interest.service';
import { getWebOrigin } from '../../payment/payment-config';
import { PaymentProvider, AiImageProvider } from '@hellodownloader/database';
import * as fs from 'fs';
import * as path from 'path';

type Pagination = { page?: number; limit?: number };

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private downloadProcessor: DownloadProcessorService,
    private downloadQueue: DownloadQueueService,
    private storage: StorageService,
    private paymentConfig: PaymentConfigService,
    private aiApiSettings: AiApiSettingsService,
    private fourKInterest: FourKInterestService,
  ) {}

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      totalDownloads,
      downloadsToday,
      failedToday,
      totalPlaylists,
      totalThumbnails,
      proUsers,
      revenue,
      revenueMonth,
      activeSubs,
      failedDownloads,
      guestUser,
    ] = await Promise.all([
      this.prisma.user.count({ where: { email: { not: 'guest@hellodownloader.local' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart }, email: { not: 'guest@hellodownloader.local' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekStart }, email: { not: 'guest@hellodownloader.local' } } }),
      this.prisma.download.count(),
      this.prisma.download.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.download.count({ where: { createdAt: { gte: todayStart }, status: 'FAILED' } }),
      this.prisma.playlist.count(),
      this.prisma.thumbnail.count(),
      this.prisma.user.count({ where: { plan: 'PRO' } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED', createdAt: { gte: weekStart } },
      }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.download.count({ where: { status: 'FAILED', createdAt: { gte: weekStart } } }),
      this.prisma.user.findUnique({ where: { email: 'guest@hellodownloader.local' }, select: { id: true } }),
    ]);

    const guestDownloads = guestUser
      ? await this.prisma.download.count({ where: { userId: guestUser.id } })
      : 0;

    const storage = this.getStorageStats();
    const fourKInterest = await this.fourKInterest.getCounts();

    return {
      users: totalUsers,
      newUsersToday,
      newUsersWeek,
      downloads: totalDownloads,
      downloadsToday,
      failedToday,
      playlists: totalPlaylists,
      thumbnails: totalThumbnails,
      proUsers,
      activeSubscriptions: activeSubs,
      revenue: revenue._sum.amount ?? 0,
      revenueWeek: revenueMonth._sum.amount ?? 0,
      failedDownloadsWeek: failedDownloads,
      guestDownloads,
      storage,
      fourKInterest,
    };
  }

  async listUsers(opts: Pagination & { search?: string; plan?: string; role?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      email: { not: 'guest@hellodownloader.local' },
    };
    if (opts.search?.trim()) {
      where.OR = [
        { email: { contains: opts.search.trim() } },
        { name: { contains: opts.search.trim() } },
      ];
    }
    if (opts.plan) where.plan = opts.plan;
    if (opts.role) where.role = opts.role;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          credits: true,
          createdAt: true,
          _count: { select: { downloads: true, playlists: true, thumbnails: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        downloadCount: u._count.downloads,
        playlistCount: u._count.playlists,
        thumbnailCount: u._count.thumbnails,
        _count: undefined,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        credits: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        creditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { downloads: true, playlists: true, thumbnails: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      downloadCount: user._count.downloads,
      playlistCount: user._count.playlists,
      thumbnailCount: user._count.thumbnails,
      _count: undefined,
    };
  }

  async updateUser(
    id: string,
    data: { plan?: PlanType; role?: 'USER' | 'ADMIN'; credits?: number; creditsDelta?: number; name?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (data.creditsDelta != null && data.creditsDelta !== 0) {
      if (data.creditsDelta > 0) {
        await this.credits.add(id, data.creditsDelta, 'Admin adjustment');
      } else {
        await this.credits.deduct(id, Math.abs(data.creditsDelta), 'Admin adjustment');
      }
    }

    const update: Record<string, unknown> = {};
    if (data.plan) update.plan = data.plan;
    if (data.role) update.role = data.role;
    if (data.name !== undefined) update.name = data.name;
    if (data.credits != null) update.credits = data.credits;

    if (Object.keys(update).length === 0 && data.creditsDelta == null) {
      return this.getUser(id);
    }

    await this.prisma.user.update({ where: { id }, data: update });
    return this.getUser(id);
  }

  async resetUserPassword(id: string, password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  async listDownloads(opts: Pagination & { status?: string; type?: string; userId?: string; search?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.type) where.type = opts.type;
    if (opts.userId) where.userId = opts.userId;
    if (opts.search?.trim()) {
      where.OR = [
        { title: { contains: opts.search.trim() } },
        { url: { contains: opts.search.trim() } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.download.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.download.count({ where }),
    ]);

    return {
      items: items.map((d) => this.serializeDownloadRow(d)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async listPlaylists(opts: Pagination & { status?: string; userId?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.userId) where.userId = opts.userId;

    const [items, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.playlist.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        status: p.status,
        progress: p.progress,
        itemCount: p.itemCount,
        fileAvailable: !!p.zipPath,
        error: p.error,
        user: p.user,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async cancelDownload(id: string) {
    const row = await this.prisma.download.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Download not found');
    if (row.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel completed download');
    }
    await this.prisma.download.update({
      where: { id },
      data: { status: 'CANCELLED', progress: 0 },
    });
    return { ok: true };
  }

  async retryDownload(id: string) {
    const row = await this.prisma.download.findUnique({ where: { id }, include: { user: true } });
    if (!row) throw new NotFoundException('Download not found');

    await this.prisma.download.update({
      where: { id },
      data: { status: 'QUEUED', progress: 0, error: null },
    });

    const jobData = {
      downloadId: row.id,
      userId: row.userId,
      url: row.url,
      type: row.type as DownloadType,
      format: row.format ?? undefined,
      quality: row.quality ?? undefined,
      plan: row.user.plan as PlanType,
    };

    const jobResult = await this.downloadQueue.addJob(jobData);
    if (jobResult && 'inline' in jobResult && jobResult.inline) {
      void this.downloadProcessor.process(jobData);
    }

    return { ok: true, message: 'Download requeued' };
  }

  async deleteDownloadFile(id: string) {
    const row = await this.prisma.download.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Download not found');
    if (row.filePath) deleteLocalFile(row.filePath);
    await this.prisma.download.update({
      where: { id },
      data: { filePath: null, fileUrl: null },
    });
    return { ok: true };
  }

  async listThumbnails(opts: Pagination & { status?: string; userId?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.userId) where.userId = opts.userId;

    const [items, total] = await Promise.all([
      this.prisma.thumbnail.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.thumbnail.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        videoUrl: t.videoUrl,
        ratio: t.ratio,
        status: t.status,
        creditsUsed: t.creditsUsed,
        error: t.error,
        ocrData: t.ocrData,
        user: t.user,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getPaymentOverview() {
    const providers = ['STRIPE', 'BINANCE', 'SSLCOMMERZ'] as const;
    const [byProvider, byStatus, recentPending] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['provider', 'status'],
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
    ]);

    const providerStats = providers.map((id) => {
      const rows = byProvider.filter((r) => r.provider === id);
      const completed = rows.find((r) => r.status === 'COMPLETED');
      const pending = rows.find((r) => r.status === 'PENDING');
      const failed = rows.filter((r) => r.status === 'FAILED' || r.status === 'REFUNDED');
      const failedCount = failed.reduce((n, r) => n + r._count.id, 0);

      return {
        id,
        completedCount: completed?._count.id ?? 0,
        pendingCount: pending?._count.id ?? 0,
        failedCount,
        revenue: completed?._sum.amount ?? 0,
      };
    });

    const configs = await this.paymentConfig.getAll();
    const meta: Record<string, { name: string; description: string; webhookUrl: string }> = {
      STRIPE: {
        name: 'Stripe',
        description: 'Cards & international checkout',
        webhookUrl: '/api/v1/webhooks/stripe',
      },
      BINANCE: {
        name: 'Binance Pay',
        description: 'Crypto payments (USDT)',
        webhookUrl: '/api/v1/webhooks/binance',
      },
      SSLCOMMERZ: {
        name: 'SSLCommerz',
        description: 'Bangladesh — bKash, Nagad, cards',
        webhookUrl: '/api/v1/webhooks/sslcommerz/ipn',
      },
    };

    const methods = configs.map((c) => ({
      id: c.provider,
      name: meta[c.provider].name,
      description: meta[c.provider].description,
      currency: c.currency,
      amount: c.amount,
      enabled: c.enabled,
      mode: c.mode,
      configured: c.configured,
      webhookUrl: meta[c.provider].webhookUrl,
      stats: providerStats.find((s) => s.id === c.provider) ?? {
        completedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        revenue: 0,
      },
    }));

    return {
      webOrigin: getWebOrigin(),
      pendingPayments: recentPending,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      methods,
    };
  }

  getPaymentConfigs() {
    return this.paymentConfig.getAllForAdmin();
  }

  updatePaymentConfig(
    provider: PaymentProvider,
    data: {
      enabled?: boolean;
      mode?: 'TEST' | 'LIVE';
      amount?: number;
      currency?: string;
      secrets?: Record<string, string>;
    },
  ) {
    return this.paymentConfig.update(provider, data);
  }

  getApiSettings() {
    return this.aiApiSettings.getSettings();
  }

  testOpenAiApi(data: { apiKey?: string; textModel: 'gpt-5-mini' | 'gpt-5' }) {
    return this.aiApiSettings.testOpenAi(data.apiKey, data.textModel);
  }

  testFalApi(data: { apiKey?: string }) {
    return this.aiApiSettings.testFal(data.apiKey);
  }

  saveAiProviders(data: {
    textModel: 'gpt-5-mini' | 'gpt-5';
    imageProvider: 'fal' | 'openai';
    basicImageModel: string;
    proImageModel: string;
    openaiApiKey?: string;
    openaiVerificationToken?: string;
    falApiKey?: string;
    falVerificationToken?: string;
  }) {
    return this.aiApiSettings.saveProviders(data as Parameters<AiApiSettingsService['saveProviders']>[0]);
  }

  saveAiFeatures(data: {
    enableAiAnalysis?: boolean;
    enableAiThumbnailGeneration?: boolean;
    enableAiImproveThumbnail?: boolean;
    enableAutoCategoryDetection?: boolean;
    enableThumbnailScoring?: boolean;
    enableAutoLayoutDetection?: boolean;
  }) {
    return this.aiApiSettings.saveFeatures(data);
  }

  async listPayments(opts: Pagination & { status?: string; provider?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.provider) where.provider = opts.provider;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listSubscriptions(opts: Pagination & { status?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async listCreditLogs(opts: Pagination & { userId?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (opts.userId) where.userId = opts.userId;

    const [items, total] = await Promise.all([
      this.prisma.creditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true } } },
      }),
      this.prisma.creditLog.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  getStorageStats() {
    const base = process.env.STORAGE_PATH ?? './storage';
    const dirs = ['downloads', 'playlists', 'thumbnails', 'temp', 'cache'];
    const breakdown: Record<string, { files: number; bytes: number }> = {};
    let totalBytes = 0;
    let totalFiles = 0;

    for (const dir of dirs) {
      const stats = this.dirStats(path.join(base, dir));
      breakdown[dir] = stats;
      totalBytes += stats.bytes;
      totalFiles += stats.files;
    }

    return {
      basePath: base,
      totalBytes,
      totalFiles,
      totalMb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
      breakdown,
      retentionHours: adminRuntimeConfig.getRetentionHours(parseInt(process.env.FILE_RETENTION_HOURS ?? '1', 10)),
    };
  }

  async runCleanup(hours?: number) {
    const h = hours ?? adminRuntimeConfig.getRetentionHours(parseInt(process.env.FILE_RETENTION_HOURS ?? '1', 10));
    const removed = await this.storage.cleanupOlderThan(h);
    return { ok: true, removed, hours: h };
  }

  async getAnalytics() {
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [byType, byStatus, byPlan, topEvents, dailyDownloads] = await Promise.all([
      this.prisma.download.groupBy({ by: ['type'], _count: { id: true } }),
      this.prisma.download.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.user.groupBy({ by: ['plan'], _count: { id: true }, where: { email: { not: 'guest@hellodownloader.local' } } }),
      this.prisma.analytics.groupBy({ by: ['event'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
      this.prisma.download.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { createdAt: true },
      }),
    ]);

    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of dailyDownloads) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
    }

    return {
      downloadsByType: Object.fromEntries(byType.map((r) => [r.type, r._count.id])),
      downloadsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      usersByPlan: Object.fromEntries(byPlan.map((r) => [r.plan, r._count.id])),
      topEvents: topEvents.map((e) => ({ event: e.event, count: e._count.id })),
      downloadsPerDay: Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })),
    };
  }

  getSystemHealth() {
    return {
      nodeVersion: process.version,
      redisEnabled: process.env.USE_BULLMQ_DOWNLOADS === 'true',
      redisConnected: this.downloadQueue.redisAvailable,
      inlineDownloads: process.env.USE_BULLMQ_DOWNLOADS !== 'true',
      fileRetentionHours: adminRuntimeConfig.getRetentionHours(parseInt(process.env.FILE_RETENTION_HOURS ?? '1', 10)),
      deleteAfterDownload: process.env.DELETE_FILE_AFTER_DOWNLOAD !== 'false',
      storagePath: process.env.STORAGE_PATH ?? './storage',
      apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  getSettings() {
    return {
      planLimits: PLAN_LIMITS,
      creditCosts: CREDIT_COSTS,
      retentionHours: adminRuntimeConfig.getRetentionHours(parseInt(process.env.FILE_RETENTION_HOURS ?? '1', 10)),
      downloadQualityAccess: adminRuntimeConfig.getDownloadQualityAccess(),
    };
  }

  updateSettings(patch: {
    retentionHours?: number;
    downloadQualityAccess?: Partial<HdQualityAccessConfig>;
  }) {
    if (patch.retentionHours != null) {
      adminRuntimeConfig.setRetentionHours(Math.max(1, Math.min(168, patch.retentionHours)));
    }
    if (patch.downloadQualityAccess) {
      adminRuntimeConfig.setDownloadQualityAccess(patch.downloadQualityAccess);
    }
    return this.getSettings();
  }

  private dirStats(dir: string): { files: number; bytes: number } {
    let files = 0;
    let bytes = 0;
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else {
          files++;
          bytes += fs.statSync(full).size;
        }
      }
    };
    walk(dir);
    return { files, bytes };
  }

  private serializeDownloadRow(d: {
    id: string;
    userId: string;
    url: string;
    type: string;
    status: string;
    title: string | null;
    quality: number | null;
    progress: number;
    error: string | null;
    filePath: string | null;
    fileSize: bigint | null;
    createdAt: Date;
    completedAt: Date | null;
    user: { id: string; email: string; name: string | null };
  }) {
    return {
      id: d.id,
      userId: d.userId,
      url: d.url,
      type: d.type,
      status: d.status,
      title: d.title,
      quality: d.quality,
      progress: d.status === 'COMPLETED' ? 100 : d.progress,
      error: d.error,
      fileAvailable: d.status === 'COMPLETED' && !!d.filePath,
      fileSize: d.fileSize?.toString() ?? null,
      user: d.user,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    };
  }

  uploadBranding(file: { buffer: Buffer; originalname: string; mimetype: string }) {
    return this.uploadPublicImage(file, 'logo');
  }

  uploadAdImage(file: { buffer: Buffer; originalname: string; mimetype: string }) {
    return this.uploadPublicImage(file, 'ad');
  }

  private uploadPublicImage(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    prefix: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No image file provided');
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);
    if (!allowed.has(ext)) {
      throw new BadRequestException('Use PNG, JPG, WebP, GIF, or ICO');
    }
    if (!file.mimetype.startsWith('image/') && ext !== '.ico') {
      throw new BadRequestException('File must be an image');
    }

    const webPublicUploads = path.resolve(process.cwd(), '../web/public/uploads');
    fs.mkdirSync(webPublicUploads, { recursive: true });

    const safeName = `${prefix}-${Date.now()}${ext}`;
    const dest = path.join(webPublicUploads, safeName);
    fs.writeFileSync(dest, file.buffer);

    return { url: `/uploads/${safeName}` };
  }
}
