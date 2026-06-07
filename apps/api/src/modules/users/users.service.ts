import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageSettingsService } from '../storage-settings/storage-settings.service';
import { getHistorySince, PLAN_LIMITS, type PlanType } from '@hellodownloader/shared-types';
import { isR2Reference } from '../../utils/r2-storage';
import { isStoredFileAvailable } from '../../utils/stored-file';

export type DashboardActivity = {
  id: string;
  kind: 'VIDEO' | 'PLAYLIST' | 'THUMBNAIL';
  title: string;
  status: string;
  progress: number;
  fileAvailable: boolean;
  storedOnCloud: boolean;
  createdAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storageSettings: StorageSettingsService,
  ) {}

  async getDashboardStats(
    userId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 10;
    const listTake = 500;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, plan: true },
    });
    const plan = (user?.plan ?? 'FREE') as PlanType;
    const historySince = getHistorySince(plan);
    const sinceFilter = historySince ? { createdAt: { gte: historySince } } : {};

    const downloadWhere = { userId, ...sinceFilter };
    const playlistWhere = { userId, ...sinceFilter };
    const thumbnailWhere = { userId, ...sinceFilter };

    const [
      videoCount,
      playlistCount,
      thumbnailCount,
      recentVideos,
      recentPlaylists,
      recentThumbnails,
    ] = await Promise.all([
      this.prisma.download.count({ where: downloadWhere }),
      this.prisma.playlist.count({ where: playlistWhere }),
      this.prisma.thumbnail.count({ where: thumbnailWhere }),
      this.prisma.download.findMany({
        where: downloadWhere,
        orderBy: { createdAt: 'desc' },
        take: listTake,
        select: {
          id: true,
          title: true,
          status: true,
          type: true,
          progress: true,
          filePath: true,
          createdAt: true,
        },
      }),
      this.prisma.playlist.findMany({
        where: playlistWhere,
        orderBy: { createdAt: 'desc' },
        take: listTake,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          url: true,
          zipPath: true,
          createdAt: true,
        },
      }),
      this.prisma.thumbnail.findMany({
        where: thumbnailWhere,
        orderBy: { createdAt: 'desc' },
        take: listTake,
        select: {
          id: true,
          videoUrl: true,
          status: true,
          exportPath: true,
          ocrData: true,
          createdAt: true,
        },
      }),
    ]);

    const allActivity: DashboardActivity[] = [
      ...recentVideos.map((d) => ({
        id: d.id,
        kind: d.type === 'PLAYLIST' ? ('PLAYLIST' as const) : ('VIDEO' as const),
        title: d.title ?? 'Untitled video',
        status: d.status,
        progress: d.status === 'COMPLETED' ? 100 : d.progress,
        fileAvailable: d.status === 'COMPLETED' && isStoredFileAvailable(d.filePath),
        storedOnCloud: d.status === 'COMPLETED' && isR2Reference(d.filePath),
        createdAt: d.createdAt.toISOString(),
      })),
      ...recentPlaylists.map((p) => ({
        id: p.id,
        kind: 'PLAYLIST' as const,
        title: p.title ?? 'Playlist',
        status: p.status,
        progress: p.status === 'COMPLETED' ? 100 : p.progress,
        fileAvailable: p.status === 'COMPLETED' && isStoredFileAvailable(p.zipPath),
        storedOnCloud: p.status === 'COMPLETED' && isR2Reference(p.zipPath),
        createdAt: p.createdAt.toISOString(),
      })),
      ...recentThumbnails.map((t) => {
        const ocr = t.ocrData as { mode?: string; title?: string } | null;
        const isOriginal = ocr?.mode === 'original';
        return {
          id: t.id,
          kind: 'THUMBNAIL' as const,
          title: ocr?.title ?? (isOriginal ? 'Original thumbnail' : 'AI thumbnail'),
          status: t.status,
          progress: t.status === 'COMPLETED' ? 100 : 50,
          fileAvailable: t.status === 'COMPLETED' && isStoredFileAvailable(t.exportPath),
          storedOnCloud: t.status === 'COMPLETED' && isR2Reference(t.exportPath),
          createdAt: t.createdAt.toISOString(),
        };
      }),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const isDownloadable = (item: DashboardActivity) =>
      item.status === 'COMPLETED' && item.fileAvailable;

    const hiddenCount = allActivity.filter((item) => !isDownloadable(item)).length;
    const downloadableActivity = allActivity.filter(isDownloadable);
    const totalActivityPages = Math.max(1, Math.ceil(downloadableActivity.length / limit));
    const safePage = downloadableActivity.length === 0 ? 1 : Math.min(page, totalActivityPages);
    const start = (safePage - 1) * limit;
    const recentActivity = downloadableActivity.slice(start, start + limit);
    const storage = await this.storageSettings.getCredentials();

    return {
      totalDownloads: videoCount + playlistCount,
      totalVideos: videoCount,
      totalPlaylists: playlistCount,
      totalThumbnails: thumbnailCount,
      credits: user?.credits ?? 0,
      plan,
      historyDays: PLAN_LIMITS[plan].historyDays,
      videoRetentionHours: storage.videoRetentionHours,
      thumbnailRetentionDays: storage.thumbnailRetentionDays,
      recentActivity,
      recentDownloads: recentActivity,
      hiddenCount,
      unavailableCount: hiddenCount,
      activityPage: safePage,
      activityTotalPages: totalActivityPages,
      activityTotal: downloadableActivity.length,
    };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, plan: true, credits: true },
    });
  }
}
