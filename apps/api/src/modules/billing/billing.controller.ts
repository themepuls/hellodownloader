import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../auth/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('subscription')
  subscription(@Req() req: { user: { id: string } }) {
    return this.billingService.getSubscription(req.user.id);
  }

  @Get('payments')
  payments(@Req() req: { user: { id: string } }) {
    return this.billingService.getPayments(req.user.id);
  }

  @Post('checkout/stripe')
  stripeCheckout(@Req() req: { user: { id: string; email: string } }) {
    return this.billingService.createStripeCheckout(req.user.id, req.user.email);
  }

  @Post('checkout/binance')
  binanceCheckout(@Req() req: { user: { id: string } }) {
    return this.billingService.createBinanceOrder(req.user.id);
  }

  @Post('checkout/sslcommerz')
  sslcommerzCheckout(@Req() req: { user: { id: string } }) {
    return this.billingService.createSslcommerzSession(req.user.id);
  }
}
