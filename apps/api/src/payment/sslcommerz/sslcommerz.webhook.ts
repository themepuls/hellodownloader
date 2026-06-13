import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SslcommerzService } from './sslcommerz.service';
import { Public } from '../../modules/auth/public.decorator';

@SkipThrottle()
@Controller('webhooks/sslcommerz')
export class SslcommerzWebhookController {
  private readonly logger = new Logger(SslcommerzWebhookController.name);

  constructor(private sslcommerz: SslcommerzService) {}

  @Public()
  @Post('success')
  @HttpCode(200)
  async handleSuccess(@Body() payload: Record<string, string>) {
    if (!(await this.sslcommerz.verifyHashAsync(payload))) {
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
  async handleFail(@Body() payload: Record<string, string>) {
    this.logger.warn(`SSLCommerz payment failed: tran_id=${payload['tran_id']}`);
    if (!(await this.sslcommerz.verifyHashAsync(payload))) {
      this.logger.warn('SSLCommerz fail webhook hash verification failed');
      return { status: 'INVALID' };
    }
    if (payload['tran_id']) {
      await this.sslcommerz.markFailed(payload['tran_id'], 'FAILED');
    }
    return { status: 'NOTED' };
  }

  @Public()
  @Post('cancel')
  @HttpCode(200)
  async handleCancel(@Body() payload: Record<string, string>) {
    this.logger.log(`SSLCommerz payment cancelled: tran_id=${payload['tran_id']}`);
    if (!(await this.sslcommerz.verifyHashAsync(payload))) {
      this.logger.warn('SSLCommerz cancel webhook hash verification failed');
      return { status: 'INVALID' };
    }
    if (payload['tran_id']) {
      await this.sslcommerz.markFailed(payload['tran_id'], 'FAILED');
    }
    return { status: 'NOTED' };
  }

  @Public()
  @Post('ipn')
  @HttpCode(200)
  async handleIpn(@Body() payload: Record<string, string>) {
    if (!(await this.sslcommerz.verifyHashAsync(payload))) return { status: 'INVALID' };
    try {
      await this.sslcommerz.handleSuccess(payload);
      return { status: 'OK' };
    } catch {
      return { status: 'ERROR' };
    }
  }
}
