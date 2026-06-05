import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { ContentService } from '../content/content.service';
import {
  SaveAiFeaturesDto,
  SaveFreepikDto,
  SaveOpenAiDto,
  SavePlanModelsDto,
  TestFreepikDto,
  TestOpenAiDto,
} from '../ai-api-settings/ai-api-settings.dto';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PlanType } from '@hellodownloader/shared-types';
import { PaymentProvider } from '@hellodownloader/database';

class UpdateUserDto {
  @IsOptional()
  @IsIn(['FREE', 'PRO'])
  plan?: PlanType;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  @IsOptional()
  @IsInt()
  credits?: number;

  @IsOptional()
  @IsInt()
  creditsDelta?: number;

  @IsOptional()
  @IsString()
  name?: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionHours?: number;

  @IsOptional()
  ads?: {
    bannerEnabled?: boolean;
    popupEnabled?: boolean;
    rewardedEnabled?: boolean;
    creditsReward?: number;
  };
}

class CleanupDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  hours?: number;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private admin: AdminService,
    private content: ContentService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.getOverview();
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('role') role?: string,
  ) {
    return this.admin.listUsers({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      search,
      plan,
      role,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetUserPassword(id, dto.password);
  }

  @Get('downloads')
  listDownloads(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.listDownloads({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      status,
      type,
      userId,
      search,
    });
  }

  @Get('playlists')
  listPlaylists(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.admin.listPlaylists({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      status,
      userId,
    });
  }

  @Post('downloads/:id/cancel')
  cancelDownload(@Param('id') id: string) {
    return this.admin.cancelDownload(id);
  }

  @Post('downloads/:id/retry')
  retryDownload(@Param('id') id: string) {
    return this.admin.retryDownload(id);
  }

  @Delete('downloads/:id/file')
  deleteDownloadFile(@Param('id') id: string) {
    return this.admin.deleteDownloadFile(id);
  }

  @Get('thumbnails')
  listThumbnails(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.admin.listThumbnails({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      status,
      userId,
    });
  }

  @Get('payments/config')
  paymentConfig() {
    return this.admin.getPaymentConfigs();
  }

  @Patch('payments/config/:provider')
  updatePaymentConfig(
    @Param('provider') provider: PaymentProvider,
    @Body()
    body: {
      enabled?: boolean;
      mode?: 'TEST' | 'LIVE';
      amount?: number;
      currency?: string;
      secrets?: Record<string, string>;
    },
  ) {
    return this.admin.updatePaymentConfig(provider, body);
  }

  @Get('payments/overview')
  paymentOverview() {
    return this.admin.getPaymentOverview();
  }

  @Get('payments')
  listPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    return this.admin.listPayments({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      status,
      provider,
    });
  }

  @Get('subscriptions')
  listSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listSubscriptions({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      status,
    });
  }

  @Get('credits')
  listCredits(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
  ) {
    return this.admin.listCreditLogs({
      page: parseInt(page ?? '1', 10),
      limit: parseInt(limit ?? '20', 10),
      userId,
    });
  }

  @Get('storage')
  storage() {
    return this.admin.getStorageStats();
  }

  @Post('storage/cleanup')
  cleanup(@Body() dto: CleanupDto) {
    return this.admin.runCleanup(dto.hours);
  }

  @Get('analytics')
  analytics() {
    return this.admin.getAnalytics();
  }

  @Get('system')
  system() {
    return this.admin.getSystemHealth();
  }

  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Get('content/pages')
  listContentPages() {
    return this.content.listPages();
  }

  @Get('content/pages/:slug')
  getContentPage(@Param('slug') slug: string) {
    return this.content.getPage(slug, { includeUnpublished: true });
  }

  @Patch('content/pages/:slug')
  updateContentPage(
    @Param('slug') slug: string,
    @Body()
    body: {
      title?: string;
      published?: boolean;
      sections?: Record<string, unknown>;
    },
  ) {
    return this.content.updatePage(slug, body);
  }

  @Post('content/pages')
  createContentPage(
    @Body() body: { slug: string; title: string; sections?: Record<string, unknown> },
  ) {
    return this.content.createPage(body);
  }

  @Get('api-settings')
  apiSettings() {
    return this.admin.getApiSettings();
  }

  @Post('api-settings/openai/test')
  testOpenAiApi(@Body() body: TestOpenAiDto) {
    return this.admin.testOpenAiApi(body);
  }

  @Post('api-settings/openai')
  saveOpenAiApi(@Body() body: SaveOpenAiDto) {
    return this.admin.saveOpenAiApi(body);
  }

  @Post('api-settings/freepik/test')
  testFreepikApi(@Body() body: TestFreepikDto) {
    return this.admin.testFreepikApi(body);
  }

  @Post('api-settings/freepik')
  saveFreepikApi(@Body() body: SaveFreepikDto) {
    return this.admin.saveFreepikApi(body);
  }

  @Patch('api-settings/plan-models')
  savePlanModels(@Body() body: SavePlanModelsDto) {
    return this.admin.savePlanModels(body);
  }

  @Patch('api-settings/features')
  saveAiFeatures(@Body() body: SaveAiFeaturesDto) {
    return this.admin.saveAiFeatures(body);
  }

  @Post('branding/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadBranding(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    return this.admin.uploadBranding(file);
  }
}
