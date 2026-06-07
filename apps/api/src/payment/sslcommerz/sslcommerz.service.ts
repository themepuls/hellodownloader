import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { PaymentConfigService } from '../payment-config.service';
import { getWebOrigin } from '../payment-config';

interface SSLCommerzInitResponse {
  status: string;
  GatewayPageURL: string;
  sessionkey: string;
  tran_id: string;
}

@Injectable()
export class SslcommerzService {
  private readonly logger = new Logger(SslcommerzService.name);

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private paymentConfig: PaymentConfigService,
  ) {}

  private gatewayUrl(isLive: boolean) {
    return isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  async initSession(
    userId: string,
    user: { email: string; name: string | null },
  ): Promise<{ redirectUrl: string; tranId: string; sandbox?: boolean }> {
    const config = await this.paymentConfig.get('SSLCOMMERZ');
    if (!config.enabled) {
      throw new BadRequestException('SSLCommerz is disabled in admin settings');
    }

    const tranId = `hd_${userId}_${Date.now()}`;
    const origin = getWebOrigin();
    const creds = this.paymentConfig.getSslcommerzCredentials(config);

    if (!creds.storeId || !creds.storePass) {
      this.logger.warn(`SSLCommerz ${config.mode} credentials missing — sandbox redirect`);
      await this.prisma.payment.create({
        data: {
          userId,
          provider: 'SSLCOMMERZ',
          amount: config.amount,
          currency: config.currency,
          providerRef: tranId,
          status: 'PENDING',
          metadata: { sandbox: true, mode: config.mode } as object,
        },
      });
      return {
        redirectUrl: `${origin}/billing?provider=sslcommerz&sandbox=true`,
        tranId,
        sandbox: true,
      };
    }

    const apiPublic = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    const params = new URLSearchParams({
      store_id: creds.storeId,
      store_passwd: creds.storePass,
      total_amount: config.amount.toString(),
      currency: config.currency,
      tran_id: tranId,
      success_url: `${origin}/billing?success=true&provider=sslcommerz&tran_id=${tranId}`,
      fail_url: `${origin}/billing?failed=true&provider=sslcommerz&tran_id=${tranId}`,
      cancel_url: `${origin}/pricing?cancelled=true&provider=sslcommerz`,
      ipn_url: `${apiPublic}/api/v1/webhooks/sslcommerz/ipn`,
      cus_name: user.name ?? 'Customer',
      cus_email: user.email,
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: '01700000000',
      shipping_method: 'NO',
      product_name: 'HelloDownloader Pro Plan',
      product_category: 'Software',
      product_profile: 'general',
    });

    const res = await fetch(`${this.gatewayUrl(creds.isLive)}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as SSLCommerzInitResponse;
    if (data.status !== 'SUCCESS') {
      throw new BadRequestException(`SSLCommerz init failed: ${data.status}`);
    }

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'SSLCOMMERZ',
        amount: config.amount,
        currency: config.currency,
        providerRef: tranId,
        status: 'PENDING',
        metadata: { sessionkey: data.sessionkey, mode: config.mode } as object,
      },
    });

    return { redirectUrl: data.GatewayPageURL, tranId, sandbox: !creds.isLive };
  }

  async handleSuccess(payload: Record<string, string>): Promise<void> {
    const config = await this.paymentConfig.get('SSLCOMMERZ');
    const creds = this.paymentConfig.getSslcommerzCredentials(config);
    const { tran_id, val_id, status } = payload;

    if (status !== 'VALID' && status !== 'VALIDATED') {
      throw new Error('SSLCommerz payment not valid');
    }

    if (creds.storeId && creds.storePass && val_id) {
      const verifyRes = await fetch(
        `${this.gatewayUrl(creds.isLive)}/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${creds.storeId}&store_passwd=${creds.storePass}&format=json`,
      );
      const verified = (await verifyRes.json()) as { status: string };
      if (verified.status !== 'VALID' && verified.status !== 'VALIDATED') {
        throw new Error('SSLCommerz IPN verification failed');
      }
    }

    const payment = await this.prisma.payment.findFirst({ where: { providerRef: tran_id } });
    if (!payment || payment.status === 'COMPLETED') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    await this.activatePro(payment.userId, tran_id);
    this.logger.log(`SSLCommerz payment completed for user ${payment.userId}`);
  }

  async markFailed(tranId: string, status: 'FAILED' | 'REFUNDED' = 'FAILED') {
    const payment = await this.prisma.payment.findFirst({ where: { providerRef: tranId } });
    if (!payment || payment.status === 'COMPLETED') return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });
  }

  verifyHash(payload: Record<string, string>): boolean {
    // Sync wrapper unused — webhooks call verifyHashAsync
    return false;
  }

  async verifyHashAsync(payload: Record<string, string>): Promise<boolean> {
    const config = await this.paymentConfig.get('SSLCOMMERZ');
    const creds = this.paymentConfig.getSslcommerzCredentials(config);
    if (!creds.storePass) return false;
    const { verify_sign, verify_key } = payload;
    if (!verify_sign || !verify_key) return false;
    const keys = verify_key.split(',');
    const hashString =
      keys.map((k) => `${k}=${payload[k] ?? ''}`).join('&') +
      `&store_passwd=${crypto.createHash('md5').update(creds.storePass).digest('hex')}`;
    return crypto.createHash('md5').update(hashString).digest('hex') === verify_sign;
  }

  private async activatePro(userId: string, tranId: string) {
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
          provider: 'SSLCOMMERZ',
          providerSubId: tranId,
        },
      }),
    ]);

    const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
    await this.credits.add(userId, monthlyCredits, 'sslcommerz_pro_subscription');
  }
}
