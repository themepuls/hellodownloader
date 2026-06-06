import { PrismaClient } from '@hellodownloader/database';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import sharp = require('sharp');
import { detectTextForAdjust } from './detect/text-detect';
import { smartAdjustResize } from './resize/smart-adjust';

const prisma = new PrismaClient();
const storagePath = process.env.STORAGE_PATH ?? './storage';

const RATIO_MAP: Record<string, { width: number; height: number }> = {
  YOUTUBE_16_9: { width: 1280, height: 720 },
  SHORTS_9_16: { width: 1080, height: 1920 },
  INSTAGRAM_4_5: { width: 1080, height: 1350 },
  FACEBOOK_1_1: { width: 1080, height: 1080 },
};

export async function processThumbnail(data: ThumbnailJobData) {
  const baseDir = path.join(storagePath, 'thumbnails', data.userId, data.thumbnailId);
  fs.mkdirSync(baseDir, { recursive: true });

  const originalPath = path.join(baseDir, 'original.jpg');
  const resizedPath = path.join(baseDir, 'resized.jpg');
  const exportPath = path.join(baseDir, 'upload-ready.jpg');

  await prisma.thumbnail.update({
    where: { id: data.thumbnailId },
    data: { status: 'PROCESSING' },
  });

  try {
    await execa(process.env.YT_DLP_PATH ?? 'yt-dlp', [
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

    const textRegions = await detectTextForAdjust(originalPath);
    const target = RATIO_MAP[data.ratio] ?? RATIO_MAP.YOUTUBE_16_9;

    const { scaledRegions } = await smartAdjustResize(
      originalPath,
      resizedPath,
      target,
      textRegions,
    );

    if (data.upscale) {
      await sharp(resizedPath)
        .resize(target.width * 2, target.height * 2, { kernel: sharp.kernel.lanczos3 })
        .sharpen()
        .jpeg({ quality: 95 })
        .toFile(exportPath);
    } else {
      fs.copyFileSync(resizedPath, exportPath);
    }

    await prisma.thumbnail.update({
      where: { id: data.thumbnailId },
      data: {
        status: 'COMPLETED',
        originalPath,
        resizedPath,
        exportPath,
        exportUrl: `/storage/thumbnails/${data.userId}/${data.thumbnailId}/upload-ready.jpg`,
        ocrData: scaledRegions,
      },
    });
  } catch (err) {
    await prisma.thumbnail.update({
      where: { id: data.thumbnailId },
      data: {
        status: 'FAILED',
        error: err instanceof Error ? err.message : 'Thumbnail processing failed',
      },
    });
    throw err;
  }
}
