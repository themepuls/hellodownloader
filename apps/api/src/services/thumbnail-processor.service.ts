import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import { validateThumbnailAiCredentials } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import sharp from '../utils/load-sharp';
import { pruneUserThumbnails } from '../utils/thumbnail-retention';
import { isR2Reference } from '../utils/r2-storage';
import { StorageService } from './storage.service';
import { detectTextForAdjust } from '../thumbnail-engine/detect/text-detect';
import { smartAdjustResize } from '../thumbnail-engine/resize/smart-adjust';
import { ThumbnailImageService } from './thumbnail-image.service';
import { AiApiSettingsService } from '../modules/ai-api-settings/ai-api-settings.service';

const RATIO_MAP: Record<string, { width: number; height: number }> = {
  YOUTUBE_16_9: { width: 1280, height: 720 },
  SHORTS_9_16: { width: 1080, height: 1920 },
  INSTAGRAM_4_5: { width: 1080, height: 1350 },
  FACEBOOK_1_1: { width: 1080, height: 1080 },
};

@Injectable()
export class ThumbnailProcessorService {
  private readonly logger = new Logger(ThumbnailProcessorService.name);
  private readonly storagePath = process.env.STORAGE_PATH ?? './storage';
  private readonly ytDlp = process.env.YT_DLP_PATH ?? 'yt-dlp';

  constructor(
    private prisma: PrismaService,
    private thumbnailImage: ThumbnailImageService,
    private aiSettings: AiApiSettingsService,
    private storage: StorageService,
  ) {}

  private mirrorThumbnailFilesToR2(
    userId: string,
    thumbnailId: string,
    paths: { exportPath: string; originalPath: string; resizedPath: string },
  ) {
    const prefix = `thumbnails/${userId}/${thumbnailId}`;
    this.storage.scheduleBackgroundR2Persist(paths.exportPath, `${prefix}/upload-ready.jpg`, async (stored) => {
      await this.prisma.thumbnail.update({
        where: { id: thumbnailId },
        data: { exportPath: stored },
      });
    });
    this.storage.scheduleBackgroundR2Persist(paths.originalPath, `${prefix}/original.jpg`, async (stored) => {
      await this.prisma.thumbnail.update({
        where: { id: thumbnailId },
        data: { originalPath: stored },
      });
    });
    if (fs.existsSync(paths.resizedPath) && paths.resizedPath !== paths.exportPath) {
      this.storage.scheduleBackgroundR2Persist(paths.resizedPath, `${prefix}/resized.jpg`, async (stored) => {
        await this.prisma.thumbnail.update({
          where: { id: thumbnailId },
          data: { resizedPath: stored },
        });
      });
    }
  }

  async process(data: ThumbnailJobData) {
    const baseDir = path.join(this.storagePath, 'thumbnails', data.userId, data.thumbnailId);
    fs.mkdirSync(baseDir, { recursive: true });

    const originalPath = path.join(baseDir, 'original.jpg');
    const resizedPath = path.join(baseDir, 'resized.jpg');
    const exportPath = path.join(baseDir, 'upload-ready.jpg');

    await this.prisma.thumbnail.update({
      where: { id: data.thumbnailId },
      data: { status: 'PROCESSING' },
    });

    try {
      await execa(this.ytDlp, [
        data.videoUrl,
        '--write-thumbnail',
        '--skip-download',
        '-o',
        path.join(baseDir, 'thumb'),
      ]);

      const thumbFiles = fs.readdirSync(baseDir).filter((f) => f.startsWith('thumb'));
      if (thumbFiles.length) {
        fs.renameSync(path.join(baseDir, thumbFiles[0]), originalPath);
      } else {
        throw new Error('Could not fetch original thumbnail');
      }

      const ocr = await detectTextForAdjust(originalPath);
      const target = RATIO_MAP[data.ratio] ?? RATIO_MAP.YOUTUBE_16_9;
      const mode = data.mode ?? 'adjust';
      const config = await this.aiSettings.getCredentials();

      const useAiRegenerate =
        mode === 'adjust'
          ? config.features.enableAiImproveThumbnail
          : config.features.enableAiThumbnailGeneration;

      const hasProvider =
        validateThumbnailAiCredentials({
          mode,
          imageProvider: config.imageProvider,
          openaiApiKey: config.openaiApiKey,
          falApiKey: config.falApiKey,
        }) === null;

      let scaledRegions = ocr.regions;

      if (useAiRegenerate && hasProvider) {
        this.logger.log(`AI regenerating thumbnail ${data.thumbnailId} (${mode})`);
        await this.thumbnailImage.generate({
          referenceImagePath: originalPath,
          outputPath: exportPath,
          mode,
          ratio: data.ratio,
          prompt: data.prompt,
          adjustPrompt: data.adjustPrompt,
          ocrLines: ocr.lines,
          fullOcrText: ocr.fullText,
          planModel: data.planModel,
          plan: data.plan,
        });

        const normalized = path.join(baseDir, 'normalized.jpg');
        await sharp(exportPath)
          .resize(target.width, target.height, { fit: 'cover', position: 'centre' })
          .sharpen()
          .jpeg({ quality: 94 })
          .toFile(normalized);
        fs.copyFileSync(normalized, exportPath);

        if (data.upscale) {
          const upscaled = path.join(baseDir, 'upscaled.jpg');
          await sharp(exportPath)
            .resize(target.width * 2, target.height * 2, { kernel: sharp.kernel.lanczos3 })
            .sharpen()
            .jpeg({ quality: 95 })
            .toFile(upscaled);
          fs.copyFileSync(upscaled, exportPath);
        }

        fs.copyFileSync(exportPath, resizedPath);
      } else if (mode === 'adjust') {
        const result = await smartAdjustResize(
          originalPath,
          resizedPath,
          target,
          ocr.regions,
        );
        scaledRegions = result.scaledRegions;

        if (data.upscale) {
          await sharp(resizedPath)
            .resize(target.width * 2, target.height * 2, { kernel: sharp.kernel.lanczos3 })
            .sharpen()
            .jpeg({ quality: 95 })
            .toFile(exportPath);
        } else {
          fs.copyFileSync(resizedPath, exportPath);
        }
      } else {
        throw new Error('AI generation requires fal.ai or OpenAI configured in Admin → API Settings.');
      }

      await this.prisma.thumbnail.update({
        where: { id: data.thumbnailId },
        data: {
          status: 'COMPLETED',
          originalPath,
          resizedPath,
          exportPath,
          exportUrl: `/api/v1/thumbnails/${data.thumbnailId}/file`,
          ocrData: JSON.parse(
            JSON.stringify({
              regions: scaledRegions,
              lines: ocr.lines,
              aiRegenerated: useAiRegenerate && hasProvider,
            }),
          ),
        },
      });

      this.logger.log(`Thumbnail ${data.thumbnailId} ready locally`);
      void this.mirrorThumbnailFilesToR2(data.userId, data.thumbnailId, {
        exportPath,
        originalPath,
        resizedPath,
      });

      await pruneUserThumbnails(this.prisma, this.storagePath, data.userId, async (row) => {
        for (const ref of [row.exportPath, row.originalPath, row.resizedPath]) {
          if (ref && isR2Reference(ref)) {
            await this.storage.deleteR2Reference(ref);
          }
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Thumbnail processing failed';
      this.logger.error(`Thumbnail ${data.thumbnailId} failed: ${message}`);
      await this.prisma.thumbnail.update({
        where: { id: data.thumbnailId },
        data: {
          status: 'FAILED',
          error: message,
        },
      });
    }
  }
}
