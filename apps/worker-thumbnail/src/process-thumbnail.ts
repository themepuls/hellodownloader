import { PrismaClient } from '@hellodownloader/database';
import type { ThumbnailJobData } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const prisma = new PrismaClient();
const storagePath = process.env.STORAGE_PATH ?? './storage';

const RATIO_MAP: Record<string, { w: number; h: number }> = {
  YOUTUBE_16_9: { w: 1280, h: 720 },
  SHORTS_9_16: { w: 1080, h: 1920 },
  INSTAGRAM_4_5: { w: 1080, h: 1350 },
  FACEBOOK_1_1: { w: 1080, h: 1080 },
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
      '-o', path.join(baseDir, 'thumb'),
    ]);

    const thumbFiles = fs.readdirSync(baseDir).filter((f) => f.startsWith('thumb'));
    if (thumbFiles.length) {
      fs.renameSync(path.join(baseDir, thumbFiles[0]), originalPath);
    } else {
      throw new Error('Could not fetch original thumbnail');
    }

    const ocrWorker = await createWorker('eng');
    const { data: ocrData } = await ocrWorker.recognize(originalPath);
    await ocrWorker.terminate();

    const ocrRegions = (ocrData.words ?? []).map((w) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      confidence: w.confidence,
    }));

    const target = RATIO_MAP[data.ratio] ?? RATIO_MAP.YOUTUBE_16_9;
    await sharp(originalPath)
      .resize(target.w, target.h, { fit: 'cover', position: 'centre' })
      .sharpen()
      .jpeg({ quality: 92 })
      .toFile(resizedPath);

    if (data.upscale) {
      await sharp(resizedPath)
        .resize(target.w * 2, target.h * 2, { kernel: sharp.kernel.lanczos3 })
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
        ocrData: ocrRegions,
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
