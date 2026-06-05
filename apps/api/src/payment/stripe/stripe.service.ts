import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';
import { PaymentConfigService } from '../payment-config.service';
import { getWebOrigin } from '../payment-config';

@Injectable()
export class StripeService {
  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private paymentConfig: PaymentConfigService,
  ) {}

  private stripeClient(secretKey: string) {
    return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
  }

  async createCheckoutSession(userId: string, email: string) {
    const config = await this.paymentConfig.get('STRIPE');
    if (!config.enabled) {
      throw new BadRequestException('Stripe payments are disabled in admin settings');
    }
    const creds = this.paymentConfig.getStripeCredentials(config);
    if (!creds.secretKey || !creds.priceId) {
      throw new BadRequestException(
        `Configure Stripe ${config.mode} keys in Admin → Payments → Configure`,
      );
    }

    const stripe = this.stripeClient(creds.secretKey);
    const origin = getWebOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: creds.priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=true&provider=stripe`,
      cancel_url: `${origin}/pricing?cancelled=true&provider=stripe`,
      metadata: { userId, gatewayMode: config.mode },
    });

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'STRIPE',
        amount: config.amount,
        currency: config.currency,
        providerRef: session.id,
        status: 'PENDING',
        metadata: { sessionId: session.id, mode: config.mode } as object,
      },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return { url: session.url, sessionId: session.id };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const config = await this.paymentConfig.get('STRIPE');
    const creds = this.paymentConfig.getStripeCredentials(config);
    if (!creds.secretKey || !creds.webhookSecret) {
      throw new BadRequestException('Stripe webhook not configured for current mode');
    }

    const stripe = this.stripeClient(creds.secretKey);
    const event = stripe.webhooks.constructEvent(payload, signature, creds.webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) return;

      const payment = await this.prisma.payment.findFirst({
        where: { providerRef: session.id, provider: 'STRIPE' },
      });

      if (payment && payment.status !== 'COMPLETED') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED' },
        });
      } else if (!payment) {
        await this.prisma.payment.create({
          data: {
            userId,
            provider: 'STRIPE',
            amount: config.amount,
            currency: config.currency,
            providerRef: session.id,
            status: 'COMPLETED',
            metadata: { sessionId: session.id } as object,
          },
        });
      }

      const existingSub = await this.prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE', provider: 'STRIPE' },
      });

      if (!existingSub) {
        await this.prisma.$transaction([
          this.prisma.user.update({ where: { id: userId }, data: { plan: 'PRO' } }),
          this.prisma.subscription.create({
            data: {
              userId,
              plan: 'PRO',
              status: 'ACTIVE',
              provider: 'STRIPE',
              providerSubId: (session.subscription as string) ?? session.id,
            },
          }),
        ]);
        const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
        await this.credits.add(userId, monthlyCredits, 'stripe_pro_subscription');
      }
    }
  }
}
