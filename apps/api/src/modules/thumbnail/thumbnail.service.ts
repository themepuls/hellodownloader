import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ThumbnailQueueService } from '../../queues/thumbnail.queue';
import { ThumbnailProcessorService } from '../../services/thumbnail-processor.service';
import { CreditsService } from '../credits/credits.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { ThumbnailPromptsService } from '../thumbnail-prompts/thumbnail-prompts.service';
import { AiApiSettingsService } from '../ai-api-settings/ai-api-settings.service';
import { CREDIT_COSTS, formatThumbnailResolution, PLAN_LIMITS, validateThumbnailAiCredentials } from '@hellodownloader/shared-types';
import type { PlanType } from '@hellodownloader/shared-types';
import { ThumbnailRatio } from '@hellodownloader/shared-types';

export type ThumbnailMode = 'adjust' | 'generate';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(
    private prisma: PrismaService,
    private thumbnailQueue: ThumbnailQueueService,
    private thumbnailProcessor: ThumbnailProcessorService,
    private creditsService: CreditsService,
    private ytDlp: YtDlpService,
    private aiApiSettings: AiApiSettingsService,
    private thumbnailPrompts: ThumbnailPromptsService,
  ) {}

  async getOriginalThumbnail(url: string) {
    const meta = await this.ytDlp.extractMetadata(url);
    if (!meta.thumbnail) {
      throw new BadRequestException('No thumbnail found for this video');
    }

    const best = await this.ytDlp.resolveBestThumbnail(url, {
      videoId: meta.id,
      fallbackUrl: meta.thumbnail,
      fallbackWidth: meta.thumbnailWidth,
      fallbackHeight: meta.thumbnailHeight,
    });

    const resolution = formatThumbnailResolution(best.width, best.height);
    const isYouTube = /youtube\.com|youtu\.be/i.test(url);
    const maxQualityNote = isYouTube
      ? best.width >= 1280
        ? 'Maximum YouTube upload thumbnail (1280×720). Video resolution (4K/HD) does not increase thumbnail size.'
        : 'Best available thumbnail for this video — uploader may not have provided a high-res image.'
      : undefined;

    return {
      thumbnail: best.url,
      title: meta.title,
      channel: meta.uploader,
      width: best.width,
      height: best.height,
      resolution,
      maxQualityNote,
    };
  }

  async createAi(
    userId: string,
    plan: PlanType,
    videoUrl: string,
    ratio: ThumbnailRatio,
    mode: ThumbnailMode,
    userPrompt?: string,
    categorySlug?: string,
    additionalInstructions?: string,
  ) {
    if (mode === 'adjust' && !PLAN_LIMITS[plan].aiThumbnailAdjust) {
      throw new BadRequestException('AI thumbnail adjust requires Pro plan');
    }
    if (mode === 'generate' && !PLAN_LIMITS[plan].aiThumbnailGenerate) {
      throw new BadRequestException('AI thumbnail generation requires Pro plan');
    }

    const creditCost =
      mode === 'generate' ? CREDIT_COSTS.THUMBNAIL_AI_GENERATE : CREDIT_COSTS.THUMBNAIL_AI_ADJUST;

    await this.creditsService.deduct(userId, creditCost, `thumbnail_ai_${mode}`);

    const aiConfig = await this.aiApiSettings.getCredentials();
    const planModel = plan === 'PRO' ? aiConfig.proImageModel : aiConfig.basicImageModel;

    if (mode === 'generate' && !aiConfig.features.enableAiThumbnailGeneration) {
      throw new BadRequestException('AI thumbnail generation is disabled in Admin → API Settings.');
    }

    if (mode === 'adjust') {
      if (!aiConfig.features.enableAiImproveThumbnail) {
        throw new BadRequestException('AI thumbnail adjust is disabled in Admin → API Settings.');
      }
      if (!aiConfig.features.enableAiAnalysis) {
        throw new BadRequestException(
          'Enable AI Analysis in Admin → API Settings — AI Adjust needs vision to read your thumbnail.',
        );
      }
    }

    const credentialError = validateThumbnailAiCredentials({
      mode,
      imageProvider: aiConfig.imageProvider,
      openaiApiKey: aiConfig.openaiApiKey,
      falApiKey: aiConfig.falApiKey,
    });
    if (credentialError) {
      throw new BadRequestException(credentialError);
    }

    const combinedPrompt =
      mode === 'generate'
        ? await this.thumbnailPrompts.composeGeneratePrompt(
            userPrompt?.trim() ?? '',
            categorySlug,
            additionalInstructions,
          )
        : undefined;

    const adjustPrompt =
      mode === 'adjust' ? await this.thumbnailPrompts.composeAdjustPrompt(categorySlug) : undefined;

    const thumbnail = await this.prisma.thumbnail.create({
      data: {
        userId,
        videoUrl,
        ratio,
        status: 'PENDING',
        creditsUsed: creditCost,
        ocrData:
          mode === 'generate'
            ? {
                mode,
                userPrompt: userPrompt ?? '',
                combinedPrompt,
                categorySlug: categorySlug ?? null,
                planModel,
                imageProvider: aiConfig.imageProvider,
                textModel: aiConfig.textModel,
                openaiModel: aiConfig.textModel,
              }
            : {
                mode: 'adjust',
                categorySlug: categorySlug ?? null,
                adjustPrompt,
              },
      },
    });

    const jobData = {
      thumbnailId: thumbnail.id,
      userId,
      videoUrl,
      ratio,
      upscale: false,
      mode,
      prompt: mode === 'generate' ? combinedPrompt : undefined,
      adjustPrompt: mode === 'adjust' ? adjustPrompt : undefined,
      planModel,
      imageProvider: aiConfig.imageProvider,
      plan,
    };

    const jobResult = await this.thumbnailQueue.addJob(jobData);

    if (jobResult && 'inline' in jobResult && jobResult.inline) {
      this.logger.log(`Processing thumbnail ${thumbnail.id} inline...`);
      void this.thumbnailProcessor.process(jobData);
    } else {
      this.logger.warn(
        `Thumbnail ${thumbnail.id} queued in Redis — run: pnpm --filter @hellodownloader/worker-thumbnail dev`,
      );
    }

    return {
      ...thumbnail,
      message:
        jobResult && 'inline' in jobResult && jobResult.inline
          ? 'Processing on server. Refresh your thumbnail history shortly.'
          : 'Queued in Redis — start worker-thumbnail or leave USE_BULLMQ_THUMBNAILS unset for inline processing.',
    };
  }

  async recordOriginalDownload(userId: string, url: string) {
    const meta = await this.getOriginalThumbnail(url);

    await this.prisma.thumbnail.create({
      data: {
        userId,
        videoUrl: url,
        ratio: ThumbnailRatio.YOUTUBE_16_9,
        status: 'COMPLETED',
        creditsUsed: 0,
        ocrData: { mode: 'original', title: meta.title },
      },
    });

    return meta;
  }

  async findAll(userId: string) {
    return this.prisma.thumbnail.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, id: string) {
    const row = await this.prisma.thumbnail.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('Thumbnail not found');
    }
    return row;
  }

  async getExportFile(id: string) {
    const row = await this.prisma.thumbnail.findUnique({ where: { id } });
    if (!row || row.status !== 'COMPLETED' || !row.exportPath) {
      throw new NotFoundException('File not ready yet');
    }
    return { exportPath: row.exportPath, ratio: row.ratio };
  }

  getAiFeatures() {
    return this.aiApiSettings.getPublicFeatures();
  }
}
