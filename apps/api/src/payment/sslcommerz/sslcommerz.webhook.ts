import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { SslcommerzService } from './sslcommerz.service';
import { Public } from '../../modules/auth/public.decorator';

@Controller('webhooks/sslcommerz')
export class SslcommerzWebhookController {
  private readonly logger = new Logger(SslcommerzWebhookController.name);

  constructor(private sslcommerz: SslcommerzService) {}

  @Public()
  @Post('success')
  @HttpCode(200)
  async handleSuccess(@Body() payload: Record<string, string>) {
    if (!this.sslcommerz.verifyHash(payload)) {
      this.logger.warn('SSLCommerz hash verification failed');
      return { status: 'FAILED' };
    }
    try {
      await this.sslcommerz.handleSuccess(payload);
      return { status: 'OK' };
    } catch (err) {
      this.logger.error('SSLCommerz success handler error', err);
      return { status: 'ERROR' };
    }
  }

  @Public()
  @Post('fail')
  @HttpCode(200)
  handleFail(@Body() payload: Record<string, string>) {
    this.logger.warn(`SSLCommerz payment failed: tran_id=${payload['tran_id']}`);
    return { status: 'NOTED' };
  }

  @Public()
  @Post('cancel')
  @HttpCode(200)
  handleCancel(@Body() payload: Record<string, string>) {
    this.logger.log(`SSLCommerz payment cancelled: tran_id=${payload['tran_id']}`);
    return { status: 'NOTED' };
  }

  @Public()
  @Post('ipn')
  @HttpCode(200)
  async handleIpn(@Body() payload: Record<string, string>) {
    if (!this.sslcommerz.verifyHash(payload)) return { status: 'INVALID' };
    try {
      await this.sslcommerz.handleSuccess(payload);
      return { status: 'OK' };
    } catch {
      return { status: 'ERROR' };
    }
  }
}
