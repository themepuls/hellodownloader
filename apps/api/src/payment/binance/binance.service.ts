import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { PaymentConfigService } from '../payment-config.service';
import { getWebOrigin } from '../payment-config';

interface BinanceOrderResponse {
  status: string;
  code: string;
  data: {
    prepayId: string;
    checkoutUrl: string;
  };
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly baseUrl = 'https://bpay.binanceapi.com';

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private paymentConfig: PaymentConfigService,
  ) {}

  private buildHeaders(body: string, apiKey: string, secret: string): Record<string, string> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex')
      .toUpperCase();

    return {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': apiKey,
      'BinancePay-Signature': signature,
    };
  }

  async createOrder(userId: string) {
    const config = await this.paymentConfig.get('BINANCE');
    if (!config.enabled) {
      throw new BadRequestException('Binance Pay is disabled in admin settings');
    }

    const orderId = `hd_${userId}_${Date.now()}`;
    const origin = getWebOrigin();
    const creds = this.paymentConfig.getBinanceCredentials(config);

    if (!creds.apiKey || !creds.secretKey) {
      this.logger.warn(`Binance ${config.mode} keys missing — sandbox redirect`);
      await this.prisma.payment.create({
        data: {
          userId,
          provider: 'BINANCE',
          amount: config.amount,
          currency: config.currency,
          providerRef: `sandbox_${orderId}`,
          status: 'PENDING',
          metadata: { orderId, sandbox: true, mode: config.mode } as object,
        },
      });
      return {
        checkoutUrl: `${origin}/billing?provider=binance&sandbox=true`,
        prepayId: `sandbox_${orderId}`,
        orderId,
        sandbox: true,
      };
    }

    const body = JSON.stringify({
      env: { terminalType: 'WEB' },
      merchantTradeNo: orderId,
      orderAmount: config.amount.toFixed(2),
      currency: config.currency,
      description: 'HelloDownloader Pro Plan',
      goodsDetails: [
        {
          goodsType: '02',
          goodsCategory: 'Z000',
          referenceGoodsId: 'pro_plan',
          goodsName: 'HelloDownloader Pro',
          goodsDetail: 'HelloDownloader Pro Plan',
        },
      ],
      returnUrl: `${origin}/billing?success=true&provider=binance`,
      cancelUrl: `${origin}/pricing?cancelled=true&provider=binance`,
    });

    const res = await fetch(`${this.baseUrl}/binancepay/openapi/v2/order`, {
      method: 'POST',
      headers: this.buildHeaders(body, creds.apiKey, creds.secretKey),
      body,
    });

    const data = (await res.json()) as BinanceOrderResponse;
    if (data.status !== 'SUCCESS') {
      throw new BadRequestException(`Binance Pay order failed: ${data.code}`);
    }

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'BINANCE',
        amount: config.amount,
        currency: config.currency,
        providerRef: data.data.prepayId,
        status: 'PENDING',
        metadata: { orderId, prepayId: data.data.prepayId, mode: config.mode } as object,
      },
    });

    return {
      checkoutUrl: data.data.checkoutUrl,
      prepayId: data.data.prepayId,
      orderId,
      sandbox: false,
    };
  }

  async handleWebhook(payload: Record<string, unknown>, signature: string): Promise<void> {
    const config = await this.paymentConfig.get('BINANCE');
    const creds = this.paymentConfig.getBinanceCredentials(config);
    if (!creds.secretKey) {
      throw new BadRequestException('Binance webhook not configured');
    }

    const body = JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac('sha512', creds.secretKey)
      .update(body)
      .digest('hex')
      .toUpperCase();

    if (signature !== expectedSig) {
      throw new Error('Invalid Binance webhook signature');
    }

    const bizType = payload['bizType'] as string;
    const bizStatus = payload['bizStatus'] as string;
    const bizId = payload['bizId'] as string;

    if (bizType === 'PAY' && bizStatus === 'PAY_SUCCESS') {
      const payment = await this.prisma.payment.findFirst({
        where: { provider: 'BINANCE', providerRef: bizId },
      });
      if (!payment || payment.status === 'COMPLETED') return;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'COMPLETED' },
      });

      await this.activatePro(payment.userId, bizId);
      this.logger.log(`Binance payment completed for user ${payment.userId}`);
    }
  }

  private async activatePro(userId: string, providerSubId: string) {
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (existing) {
      await this.prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } }),
      this.prisma.subscription.create({
        data: {
          userId,
          plan: 'PRO',
          status: 'ACTIVE',
          provider: 'BINANCE',
          providerSubId,
        },
      }),
    ]);

    const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
    await this.credits.add(userId, monthlyCredits, 'binance_pro_subscription');
  }
}
