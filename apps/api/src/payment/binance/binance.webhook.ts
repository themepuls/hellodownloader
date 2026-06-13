import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BinanceService } from './binance.service';
import { Public } from '../../modules/auth/public.decorator';

@SkipThrottle()
@Controller('webhooks/binance')
export class BinanceWebhookController {
  private readonly logger = new Logger(BinanceWebhookController.name);

  constructor(private binance: BinanceService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers('BinancePay-Signature') signature: string,
  ) {
    try {
      await this.binance.handleWebhook(payload, signature);
      return { returnCode: 'SUCCESS', returnMessage: null };
    } catch (err) {
      this.logger.error('Binance webhook error', err);
      return { returnCode: 'FAIL', returnMessage: 'Processing error' };
    }
  }
}
