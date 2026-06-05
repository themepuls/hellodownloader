import { Global, Module } from '@nestjs/common';
import { AiApiSettingsService } from './ai-api-settings.service';
import { PrismaModule } from '../../database/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AiApiSettingsService],
  exports: [AiApiSettingsService],
})
export class AiApiSettingsModule {}
