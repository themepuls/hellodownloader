import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type NotificationType = 'DOWNLOAD_COMPLETE' | 'DOWNLOAD_FAILED' | 'PAYMENT_SUCCESS' | 'CREDIT_LOW';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async notify(userId: string, type: NotificationType, payload: Record<string, string | number | boolean> = {}) {
    this.logger.log(`Notification [${type}] → user ${userId}`);

    await this.prisma.analytics.create({
      data: {
        event: `notification:${type}`,
        userId,
        metadata: payload as object,
      },
    });
  }

  async notifyDownloadComplete(userId: string, downloadId: string, title: string) {
    await this.notify(userId, 'DOWNLOAD_COMPLETE', { downloadId, title });
  }

  async notifyDownloadFailed(userId: string, downloadId: string, error: string) {
    await this.notify(userId, 'DOWNLOAD_FAILED', { downloadId, error });
  }

  async notifyPaymentSuccess(userId: string, amount: number, currency: string) {
    await this.notify(userId, 'PAYMENT_SUCCESS', { amount, currency });
  }

  async notifyCreditLow(userId: string, remaining: number) {
    await this.notify(userId, 'CREDIT_LOW', { remaining });
  }
}
