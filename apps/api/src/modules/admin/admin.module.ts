import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { DownloadModule } from '../download/download.module';
import { QueueModule } from '../../queues/queue.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [DownloadModule, QueueModule, ContentModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}
