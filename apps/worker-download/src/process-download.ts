import { PrismaClient } from '@hellodownloader/database';
import type { DownloadJobData } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const ytDlp = process.env.YT_DLP_PATH ?? 'yt-dlp';
const storagePath = process.env.STORAGE_PATH ?? './storage';

export async function processDownload(data: DownloadJobData) {
  const outputDir = path.join(storagePath, 'temp', data.downloadId);
  fs.mkdirSync(outputDir, { recursive: true });

  await prisma.download.update({
    where: { id: data.downloadId },
    data: { status: 'PROCESSING', progress: 10 },
  });

  try {
    const maxHeight = data.plan === 'PRO' ? (data.quality ?? 1080) : Math.min(data.quality ?? 720, 720);
    const args = [
      data.url,
      '-o', path.join(outputDir, '%(title).100B.%(ext)s'),
      '-f',
      data.type === 'MP3'
        ? 'bestaudio'
        : `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`,
    ];

    if (data.type === 'MP3') args.push('-x', '--audio-format', 'mp3');

    await execa(ytDlp, args);
    await prisma.download.update({
      where: { id: data.downloadId },
      data: { progress: 80 },
    });

    const files = fs.readdirSync(outputDir).filter((f) => !f.startsWith('.'));
    const filePath = path.join(outputDir, files[0]);
    const stat = fs.statSync(filePath);
    const userFolder = data.plan === 'PRO' ? 'pro-users' : 'free-users';
    const destDir = path.join(storagePath, 'downloads', userFolder, data.userId);
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, path.basename(filePath));
    fs.renameSync(filePath, destPath);

    await prisma.download.update({
      where: { id: data.downloadId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        filePath: destPath,
        fileSize: BigInt(stat.size),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.download.update({
      where: { id: data.downloadId },
      data: {
        status: 'FAILED',
        error: err instanceof Error ? err.message : 'Download failed',
      },
    });
    throw err;
  }
}
