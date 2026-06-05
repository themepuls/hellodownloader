import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';

interface BinanceOrderResponse {
  status: string;
  code: string;
  data: {
    prepayId: string;
    terminalType: string;
    expireTime: number;
    qrcodeLink: string;
    qrContent: string;
    checkoutUrl: string;
    deeplink: string;
    universalUrl: string;
  };
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly apiKey = process.env.BINANCE_API_KEY ?? '';
  private readonly secret = process.env.BINANCE_SECRET_KEY ?? '';
  private readonly baseUrl = 'https://bpay.binanceapi.com';

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
  ) {}

  private buildHeaders(body: string): Record<string, string> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto
      .createHmac('sha512', this.secret)
      .update(payload)
      .digest('hex')
      .toUpperCase();

    return {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': this.apiKey,
      'BinancePay-Signature': signature,
    };
  }

  async createOrder(
    userId: string,
    amountUsd: number,
    description = 'HelloDownloader Pro Plan',
  ): Promise<{ checkoutUrl: string; prepayId: string; orderId: string }> {
    const orderId = `hd_${userId}_${Date.now()}`;

    const body = JSON.stringify({
      env: { terminalType: 'WEB' },
      merchantTradeNo: orderId,
      orderAmount: amountUsd.toFixed(2),
      currency: 'USDT',
      description,
      goodsDetails: [
        {
          goodsType: '02',
          goodsCategory: 'Z000',
          referenceGoodsId: 'pro_plan',
          goodsName: 'HelloDownloader Pro',
          goodsDetail: description,
        },
      ],
      returnUrl: `${process.env.CORS_ORIGIN}/billing?success=true&provider=binance`,
      cancelUrl: `${process.env.CORS_ORIGIN}/pricing?cancelled=true`,
    });

    if (!this.apiKey || !this.secret) {
      this.logger.warn('Binance Pay API keys not configured — returning sandbox URL');
      return {
        checkoutUrl: `${process.env.CORS_ORIGIN}/billing?provider=binance&sandbox=true`,
        prepayId: `sandbox_${orderId}`,
        orderId,
      };
    }

    const res = await fetch(`${this.baseUrl}/binancepay/openapi/v2/order`, {
      method: 'POST',
      headers: this.buildHeaders(body),
      body,
    });

    const data = (await res.json()) as BinanceOrderResponse;
    if (data.status !== 'SUCCESS') {
      throw new Error(`Binance Pay order failed: ${data.code}`);
    }

    // Record pending payment
    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'BINANCE',
        amount: amountUsd,
        currency: 'USDT',
        providerRef: data.data.prepayId,
        status: 'PENDING',
        metadata: { orderId, prepayId: data.data.prepayId } as object,
      },
    });

    return {
      checkoutUrl: data.data.checkoutUrl,
      prepayId: data.data.prepayId,
      orderId,
    };
  }

  async handleWebhook(payload: Record<string, unknown>, signature: string): Promise<void> {
    // Verify Binance webhook signature
    const body = JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac('sha512', this.secret)
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
        where: { providerRef: bizId },
      });
      if (!payment) return;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'COMPLETED' },
      });

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: payment.userId },
          data: { plan: 'PRO' },
        }),
        this.prisma.subscription.create({
          data: {
            userId: payment.userId,
            plan: 'PRO',
            status: 'ACTIVE',
            provider: 'BINANCE',
            providerSubId: bizId,
          },
        }),
      ]);

      const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
      await this.credits.add(payment.userId, monthlyCredits, 'binance_pro_subscription');

      this.logger.log(`Binance payment completed for user ${payment.userId}`);
    }
  }
}
