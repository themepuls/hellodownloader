import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { DownloadModule } from '../download/download.module';
import { QueueModule } from '../../queues/queue.module';
import { ContentModule } from '../content/content.module';
import { SurveyModule } from '../survey/survey.module';
import { AdsModule } from '../ads/ads.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';

@Module({
  imports: [DownloadModule, QueueModule, ContentModule, SurveyModule, AdsModule, SiteSettingsModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}
