import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { CreditsService } from '../../modules/credits/credits.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCheckoutSession(userId: string, email: string) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CORS_ORIGIN}/billing?success=true`,
      cancel_url: `${process.env.CORS_ORIGIN}/pricing?cancelled=true`,
      metadata: { userId },
    });
    return { url: session.url, sessionId: session.id };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) return;

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { plan: 'PRO' },
        }),
        this.prisma.subscription.create({
          data: {
            userId,
            plan: 'PRO',
            status: 'ACTIVE',
            provider: 'STRIPE',
            providerSubId: session.subscription as string,
          },
        }),
      ]);

      const monthlyCredits = parseInt(process.env.PRO_MONTHLY_CREDITS ?? '100', 10);
      await this.credits.add(userId, monthlyCredits, 'pro_subscription');
    }
  }
}
