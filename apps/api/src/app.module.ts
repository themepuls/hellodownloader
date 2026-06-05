import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DownloadModule } from './modules/download/download.module';
import { PlaylistModule } from './modules/playlist/playlist.module';
import { ThumbnailModule } from './modules/thumbnail/thumbnail.module';
import { CreditsModule } from './modules/credits/credits.module';
import { BillingModule } from './modules/billing/billing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdsModule } from './modules/ads/ads.module';
import { AdminModule } from './modules/admin/admin.module';
import { ContentModule } from './modules/content/content.module';
import { PaymentConfigModule } from './payment/payment-config.module';
import { AiApiSettingsModule } from './modules/ai-api-settings/ai-api-settings.module';
import { QueueModule } from './queues/queue.module';
import { LoggerService } from './utils/logger';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    PaymentConfigModule,
    AiApiSettingsModule,
    QueueModule,
    AuthModule,
    UsersModule,
    DownloadModule,
    PlaylistModule,
    ThumbnailModule,
    CreditsModule,
    BillingModule,
    AnalyticsModule,
    AdsModule,
    ContentModule,
    AdminModule,
  ],
  providers: [
    LoggerService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
