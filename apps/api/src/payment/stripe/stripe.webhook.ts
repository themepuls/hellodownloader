import { Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { StripeService } from './stripe.service';
import { Public } from '../../modules/auth/public.decorator';

@SkipThrottle()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private stripeService: StripeService) {}

  @Public()
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.stripeService.handleWebhook(
      req.rawBody as Buffer,
      signature,
    );
    return { received: true };
  }
}
