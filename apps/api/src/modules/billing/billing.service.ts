import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from '../../payment/stripe/stripe.service';
import { BinanceService } from '../../payment/binance/binance.service';
import { SslcommerzService } from '../../payment/sslcommerz/sslcommerz.service';

const PRO_PRICE_USD = 9.99;
const PRO_PRICE_BDT = 1099;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private binance: BinanceService,
    private sslcommerz: SslcommerzService,
  ) {}

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
    return this.binance.createOrder(userId, PRO_PRICE_USD, 'HelloDownloader Pro Plan');
  }

  async createSslcommerzSession(userId: string) {
    return this.sslcommerz.initSession(userId, PRO_PRICE_BDT);
  }
}
