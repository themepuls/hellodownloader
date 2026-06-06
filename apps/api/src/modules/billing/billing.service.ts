import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from '../../payment/stripe/stripe.service';
import { BinanceService } from '../../payment/binance/binance.service';
import { SslcommerzService } from '../../payment/sslcommerz/sslcommerz.service';
import { PaymentConfigService } from '../../payment/payment-config.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private binance: BinanceService,
    private sslcommerz: SslcommerzService,
    private paymentConfig: PaymentConfigService,
  ) {}

  getPaymentMethods() {
    return this.paymentConfig.getPublicMethods();
  }

  async getSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createStripeCheckout(userId: string, email: string) {
    return this.stripe.createCheckoutSession(userId, email);
  }

  async createBinanceOrder(userId: string) {
    return this.binance.createOrder(userId);
  }

  async createSslcommerzSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) throw new BadRequestException('User not found');
    return this.sslcommerz.initSession(userId, user);
  }
}
