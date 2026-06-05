import { Controller, Get, Req } from '@nestjs/common';
import { AdsService } from './ads.service';
import { Public } from '../auth/public.decorator';

@Controller('ads')
export class AdsController {
  constructor(private adsService: AdsService) {}

  @Public()
  @Get('config')
  config(@Req() req: { user?: { plan: string } }) {
    return this.adsService.getAdConfig(req.user?.plan ?? 'FREE');
  }
}
