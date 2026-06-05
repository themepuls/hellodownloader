import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type PaymentProvider = 'STRIPE' | 'BINANCE' | 'SSLCOMMERZ';

export interface RecordPaymentDto {
  userId: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  providerRef: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  metadata?: Record<string, string | number | boolean>;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private prisma: PrismaService) {}

  async record(dto: RecordPaymentDto) {
    return this.prisma.payment.create({
      data: {
        userId: dto.userId,
        provider: dto.provider,
        amount: dto.amount,
        currency: dto.currency,
        providerRef: dto.providerRef,
        status: dto.status,
        metadata: (dto.metadata ?? {}) as object,
      },
    });
  }

  async markCompleted(providerRef: string) {
    return this.prisma.payment.updateMany({
      where: { providerRef },
      data: { status: 'COMPLETED' },
    });
  }

  async markFailed(providerRef: string) {
    return this.prisma.payment.updateMany({
      where: { providerRef },
      data: { status: 'FAILED' },
    });
  }

  async getUserPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
