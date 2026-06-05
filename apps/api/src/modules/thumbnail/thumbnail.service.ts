import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ThumbnailQueueService } from '../../queues/thumbnail.queue';
import { CreditsService } from '../credits/credits.service';
import { YtDlpService } from '../../services/yt-dlp.service';
import { CREDIT_COSTS, PLAN_LIMITS } from '@hellodownloader/shared-types';
import type { PlanType } from '@hellodownloader/shared-types';
import { ThumbnailRatio } from '@hellodownloader/shared-types';

export type ThumbnailMode = 'adjust' | 'generate';

@Injectable()
export class ThumbnailService {
  constructor(
    private prisma: PrismaService,
    private thumbnailQueue: ThumbnailQueueService,
    private creditsService: CreditsService,
    private ytDlp: YtDlpService,
  ) {}

  async getOriginalThumbnail(url: string) {
    const meta = await this.ytDlp.extractMetadata(url);
    if (!meta.thumbnail) {
      throw new BadRequestException('No thumbnail found for this video');
    }
    return { thumbnail: meta.thumbnail, title: meta.title };
  }

  async createAi(
    userId: string,
    plan: PlanType,
    videoUrl: string,
    ratio: ThumbnailRatio,
    mode: ThumbnailMode,
    userPrompt?: string,
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

    const globalPrompt = process.env.THUMBNAIL_AI_GLOBAL_PROMPT?.trim() ?? '';
    const combinedPrompt =
      mode === 'generate'
        ? [globalPrompt, userPrompt?.trim()].filter(Boolean).join('\n\n')
        : undefined;

    const thumbnail = await this.prisma.thumbnail.create({
      data: {
        userId,
        videoUrl,
        ratio,
        status: 'PENDING',
        creditsUsed: creditCost,
        ocrData:
          mode === 'generate'
            ? { mode, userPrompt: userPrompt ?? '', globalPrompt, combinedPrompt }
            : { mode: 'adjust' },
      },
    });

    await this.thumbnailQueue.addJob({
      thumbnailId: thumbnail.id,
      userId,
      videoUrl,
      ratio,
      upscale: mode === 'adjust',
      mode,
      prompt: combinedPrompt,
    });

    return thumbnail;
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
}
