import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from '../../payment/stripe/stripe.service';
import { BinanceService } from '../../payment/binance/binance.service';
import { SslcommerzService } from '../../payment/sslcommerz/sslcommerz.service';
import { StripeWebhookController } from '../../payment/stripe/stripe.webhook';
import { BinanceWebhookController } from '../../payment/binance/binance.webhook';
import { SslcommerzWebhookController } from '../../payment/sslcommerz/sslcommerz.webhook';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [CreditsModule],
  controllers: [
    BillingController,
    StripeWebhookController,
    BinanceWebhookController,
    SslcommerzWebhookController,
  ],
  providers: [BillingService, StripeService, BinanceService, SslcommerzService],
})
export class BillingModule {}
