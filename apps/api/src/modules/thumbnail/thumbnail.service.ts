import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { existsSync } from 'fs';
import { pruneUserThumbnails } from '../../utils/thumbnail-retention';
import { isR2Reference } from '../../utils/r2-storage';
import { getOrCreateGuestUser } from '../../utils/guest-user';
import { StorageService } from '../../services/storage.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateResourceAccessToken,
  hashResourceAccessToken,
  readAccessTokenHash,
  verifyResourceAccessToken,
  withAccessTokenHash,
} from '../../utils/resource-access';
import { assertAllowedThumbnailUrl, assertSafeVideoUrl } from '../../utils/safe-url';

export type ThumbnailMode = 'adjust' | 'generate';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly storagePath = process.env.STORAGE_PATH ?? './storage';

  constructor(
    private prisma: PrismaService,
    private thumbnailQueue: ThumbnailQueueService,
    private thumbnailProcessor: ThumbnailProcessorService,
    private creditsService: CreditsService,
    private ytDlp: YtDlpService,
    private aiApiSettings: AiApiSettingsService,
    private thumbnailPrompts: ThumbnailPromptsService,
    private storage: StorageService,
  ) {}

  private async deleteThumbnailFiles(row: {
    exportPath: string | null;
    originalPath: string | null;
    resizedPath: string | null;
  }) {
    for (const ref of [row.exportPath, row.originalPath, row.resizedPath]) {
      if (ref && isR2Reference(ref)) {
        await this.storage.deleteR2Reference(ref);
      }
    }
  }

  private async persistThumbnailImage(
    userId: string,
    thumbnailId: string,
    imageUrl: string,
  ): Promise<{ originalPath: string; exportPath: string }> {
    const safeImageUrl = assertAllowedThumbnailUrl(imageUrl);
    const destDir = path.join(this.storagePath, 'thumbnails', userId, thumbnailId);
    fs.mkdirSync(destDir, { recursive: true });
    const localPath = path.join(destDir, 'original.jpg');

    const imageFetchUrl = new URL(safeImageUrl);
    const referer = /ytimg|youtube/i.test(imageFetchUrl.hostname)
      ? 'https://www.youtube.com/'
      : imageFetchUrl.origin;

    const res = await fetch(safeImageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: referer,
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new BadRequestException('Could not download thumbnail image');
    }
    fs.writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
    return { originalPath: localPath, exportPath: localPath };
  }

  async getOriginalThumbnail(url: string) {
    const safeUrl = assertSafeVideoUrl(url);
    const meta = await this.ytDlp.extractMetadata(safeUrl);
    if (!meta.thumbnail) {
      throw new BadRequestException('No thumbnail found for this video');
    }

    const best = await this.ytDlp.resolveBestThumbnail(safeUrl, {
      videoId: meta.id,
      fallbackUrl: meta.thumbnail,
      fallbackWidth: meta.thumbnailWidth,
      fallbackHeight: meta.thumbnailHeight,
    });

    const resolution = formatThumbnailResolution(best.width, best.height);
    const isYouTube = /youtube\.com|youtu\.be/i.test(safeUrl);
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

    const safeVideoUrl = assertSafeVideoUrl(videoUrl);

    const thumbnail = await this.prisma.thumbnail.create({
      data: {
        userId,
        videoUrl: safeVideoUrl,
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
      videoUrl: safeVideoUrl,
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

  async recordOriginalDownload(
    userId: string | undefined,
    url: string,
    hints?: { thumbnailUrl?: string; title?: string },
  ) {
    const safeUrl = assertSafeVideoUrl(url);
    const meta =
      hints?.thumbnailUrl
        ? {
            thumbnail: assertAllowedThumbnailUrl(hints.thumbnailUrl),
            title: hints.title ?? 'Video thumbnail',
            channel: undefined,
            width: 480,
            height: 360,
            resolution: undefined,
            maxQualityNote: undefined,
          }
        : await this.getOriginalThumbnail(safeUrl);
    const ownerId = userId ?? (await getOrCreateGuestUser(this.prisma)).id;
    const accessToken = generateResourceAccessToken();
    const accessTokenHash = hashResourceAccessToken(accessToken);

    const thumbnail = await this.prisma.thumbnail.create({
      data: {
        userId: ownerId,
        videoUrl: safeUrl,
        ratio: ThumbnailRatio.YOUTUBE_16_9,
        status: 'PROCESSING',
        creditsUsed: 0,
        ocrData: withAccessTokenHash(
          { mode: 'original', title: meta.title },
          accessTokenHash,
        ),
      },
    });

    try {
      const stored = await this.persistThumbnailImage(ownerId, thumbnail.id, meta.thumbnail);
      await this.prisma.thumbnail.update({
        where: { id: thumbnail.id },
        data: {
          status: 'COMPLETED',
          originalPath: stored.originalPath,
          exportPath: stored.exportPath,
          exportUrl: `/api/v1/thumbnails/${thumbnail.id}/file`,
        },
      });

      const r2Key = `thumbnails/${ownerId}/${thumbnail.id}/original.jpg`;
      this.storage.scheduleBackgroundR2Persist(stored.exportPath, r2Key, async (storedPath) => {
        await this.prisma.thumbnail.update({
          where: { id: thumbnail.id },
          data: { originalPath: storedPath, exportPath: storedPath },
        });
      });

      await pruneUserThumbnails(this.prisma, this.storagePath, ownerId, (row) =>
        this.deleteThumbnailFiles(row),
      );

      return { ...meta, thumbnailId: thumbnail.id, storedOnR2: false, accessToken };
    } catch (err) {
      await this.prisma.thumbnail.delete({ where: { id: thumbnail.id } });
      throw err;
    }
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

  async assertThumbnailAccess(
    id: string,
    opts: { userId?: string; accessToken?: string },
  ) {
    const row = await this.prisma.thumbnail.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Thumbnail not found');

    if (opts.userId && row.userId === opts.userId) {
      return row;
    }

    const storedHash = readAccessTokenHash(row.ocrData);
    if (verifyResourceAccessToken(storedHash, opts.accessToken)) {
      return row;
    }

    throw new ForbiddenException('Access denied');
  }

  async getExportFile(
    id: string,
    opts: { userId?: string; accessToken?: string } = {},
  ) {
    const row = await this.assertThumbnailAccess(id, opts);
    if (row.status !== 'COMPLETED' || !row.exportPath) {
      throw new NotFoundException('File not ready yet');
    }
    if (!isR2Reference(row.exportPath) && !existsSync(row.exportPath)) {
      throw new NotFoundException('File no longer on server');
    }
    return { exportPath: row.exportPath, ratio: row.ratio };
  }

  getAiFeatures() {
    return this.aiApiSettings.getPublicFeatures();
  }
}
