import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { PrismaService } from '../../database/prisma.service';
import { getHistorySince, PLAN_LIMITS, type PlanType } from '@hellodownloader/shared-types';

export type DashboardActivity = {
  id: string;
  kind: 'VIDEO' | 'PLAYLIST' | 'THUMBNAIL';
  title: string;
  status: string;
  progress: number;
  fileAvailable: boolean;
  createdAt: string;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(userId: string) {
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
        take: 10,
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
        take: 10,
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
        take: 10,
        select: {
          id: true,
          videoUrl: true,
          status: true,
          ocrData: true,
          createdAt: true,
        },
      }),
    ]);

    const activity: DashboardActivity[] = [
      ...recentVideos.map((d) => ({
        id: d.id,
        kind: d.type === 'PLAYLIST' ? ('PLAYLIST' as const) : ('VIDEO' as const),
        title: d.title ?? 'Untitled video',
        status: d.status,
        progress: d.status === 'COMPLETED' ? 100 : d.progress,
        fileAvailable: d.status === 'COMPLETED' && !!d.filePath && existsSync(d.filePath),
        createdAt: d.createdAt.toISOString(),
      })),
      ...recentPlaylists.map((p) => ({
        id: p.id,
        kind: 'PLAYLIST' as const,
        title: p.title ?? 'Playlist',
        status: p.status,
        progress: p.status === 'COMPLETED' ? 100 : p.progress,
        fileAvailable: p.status === 'COMPLETED' && !!p.zipPath && existsSync(p.zipPath),
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
          fileAvailable: false,
          createdAt: t.createdAt.toISOString(),
        };
      }),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      totalDownloads: videoCount + playlistCount,
      totalVideos: videoCount,
      totalPlaylists: playlistCount,
      totalThumbnails: thumbnailCount,
      credits: user?.credits ?? 0,
      plan,
      historyDays: PLAN_LIMITS[plan].historyDays,
      recentActivity: activity,
      recentDownloads: activity,
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
