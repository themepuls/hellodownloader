import { Module } from '@nestjs/common';
import { AdsSettingsService } from './ads-settings.service';

@Module({
  providers: [AdsSettingsService],
  exports: [AdsSettingsService],
})
export class AdsSettingsModule {}
