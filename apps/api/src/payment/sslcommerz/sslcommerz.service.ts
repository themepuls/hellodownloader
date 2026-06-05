import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';

interface SSLCommerzInitResponse {
  status: string;
  GatewayPageURL: string;
  sessionkey: string;
  tran_id: string;
}

@Injectable()
export class SslcommerzService {
  private readonly logger = new Logger(SslcommerzService.name);
  private readonly storeId = process.env.SSLCOMMERZ_STORE_ID ?? '';
  private readonly storePass = process.env.SSLCOMMERZ_STORE_PASSWD ?? '';
  private readonly isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true';

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
  ) {}

  private get gatewayUrl() {
    return this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  async initSession(userId: string, amountBdt: number): Promise<{ redirectUrl: string; tranId: string }> {
    const tranId = `hd_${userId}_${Date.now()}`;
    const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

    const params = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePass,
      total_amount: amountBdt.toString(),
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${corsOrigin}/billing?success=true&provider=sslcommerz&tran_id=${tranId}`,
      fail_url: `${corsOrigin}/pricing?failed=true&provider=sslcommerz`,
      cancel_url: `${corsOrigin}/pricing?cancelled=true`,
      cus_name: 'Customer',
      cus_email: 'customer@hellodownloader.app',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: '01700000000',
      shipping_method: 'NO',
      product_name: 'HelloDownloader Pro Plan',
      product_category: 'Software',
      product_profile: 'general',
    });

    if (!this.storeId || !this.storePass) {
      this.logger.warn('SSLCommerz credentials not configured — returning sandbox URL');
      return {
        redirectUrl: `${corsOrigin}/billing?provider=sslcommerz&sandbox=true`,
        tranId,
      };
    }

    const res = await fetch(`${this.gatewayUrl}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as SSLCommerzInitResponse;
    if (data.status !== 'SUCCESS') {
      throw new Error(`SSLCommerz init failed: ${data.status}`);
    }

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'SSLCOMMERZ',
        amount: amountBdt,
        currency: 'BDT',
        providerRef: tranId,
        status: 'PENDING',
        metadata: { sessionkey: data.sessionkey } as object,
      },
    });

    return { redirectUrl: data.GatewayPageURL, tranId };
  }

  async handleSuccess(payload: Record<string, string>): Promise<void> {
    const { tran_id, val_id, status } = payload;
    if (status !== 'VALID' && status !== 'VALIDATED') {
      throw new Error('SSLCommerz payment not valid');
    }

    // Verify transaction with SSLCommerz IPN
    const verifyRes = await fetch(
      `${this.gatewayUrl}/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${this.storeId}&store_passwd=${this.storePass}&format=json`,
    );
    const verified = (await verifyRes.json()) as { status: string; tran_id: string };

    if (verified.status !== 'VALID' && verified.status !== 'VALIDATED') {
      throw new Error('SSLCommerz IPN verification failed');
    }

    const payment = await this.prisma.payment.findFirst({ where: { providerRef: tran_id } });
    if (!payment || payment.status === 'COMPLETED') return;

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
          provider: 'SSLCOMMERZ',
          providerSubId: tran_id,
        },
      }),
    ]);

    const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
    await this.credits.add(payment.userId, monthlyCredits, 'sslcommerz_pro_subscription');

    this.logger.log(`SSLCommerz payment completed for user ${payment.userId}`);
  }

  verifyHash(payload: Record<string, string>): boolean {
    const { verify_sign, verify_key } = payload;
    if (!verify_sign || !verify_key) return false;

    const keys = verify_key.split(',');
    const hashString = keys.map((k) => `${k}=${payload[k] ?? ''}`).join('&') + `&store_passwd=${crypto.createHash('md5').update(this.storePass).digest('hex')}`;
    const computed = crypto.createHash('md5').update(hashString).digest('hex');
    return computed === verify_sign;
  }
}
