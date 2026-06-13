import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AdsSettingsModule } from '../ads-settings/ads-settings.module';

@Module({
  imports: [AdsSettingsModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
