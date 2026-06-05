import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async track(event: string, userId?: string, metadata?: object, ip?: string) {
    return this.prisma.analytics.create({
      data: { event, userId, metadata: metadata as object, ip },
    });
  }

  async getSummary(userId: string) {
    const [downloads, thumbnails, credits, recentDownloads] = await Promise.all([
      this.prisma.download.count({ where: { userId } }),
      this.prisma.thumbnail.count({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
      this.prisma.download.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          type: true,
          progress: true,
          createdAt: true,
          completedAt: true,
          fileSize: true,
        },
      }),
    ]);

    return {
      totalDownloads: downloads,
      totalThumbnails: thumbnails,
      credits: credits?.credits ?? 0,
      recentDownloads: recentDownloads.map((d) => ({
        ...d,
        fileSize: d.fileSize?.toString() ?? null,
      })),
    };
  }

  async getDownloadStats(userId: string) {
    const byType = await this.prisma.download.groupBy({
      by: ['type'],
      where: { userId },
      _count: { id: true },
    });

    const byStatus = await this.prisma.download.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await this.prisma.download.count({
      where: { userId, createdAt: { gte: thisMonth } },
    });

    return {
      byType: Object.fromEntries(byType.map((r) => [r.type, r._count.id])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      thisMonth: monthlyCount,
    };
  }
}
