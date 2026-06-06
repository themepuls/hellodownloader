import { PrismaClient } from '@hellodownloader/database';
import type { DownloadJobData } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const storagePath = process.env.STORAGE_PATH ?? './storage';

function resolveToolPath(envKey: string, fallbacks: string[]): string {
  const configured = process.env[envKey]?.trim();
  const candidates = [configured, ...fallbacks].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return configured ?? fallbacks[fallbacks.length - 1] ?? envKey.toLowerCase();
}

const ytDlp = resolveToolPath('YT_DLP_PATH', [
  '/opt/homebrew/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
]);
const ffmpeg = resolveToolPath('FFMPEG_PATH', [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
]);

function pickOutputFile(outputDir: string, preferredExts: string[] = []): string | null {
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => !f.startsWith('.') && !f.endsWith('.part'));
  if (!files.length) return null;

  for (const ext of preferredExts) {
    const match = files.find((f) => f.toLowerCase().endsWith(`.${ext}`));
    if (match) return path.join(outputDir, match);
  }

  const ranked = files
    .map((f) => ({ fp: path.join(outputDir, f), size: fs.statSync(path.join(outputDir, f)).size }))
    .sort((a, b) => b.size - a.size);
  return ranked[0]?.fp ?? null;
}

async function ensureMp3(filePath: string): Promise<string> {
  if (path.extname(filePath).toLowerCase() === '.mp3') return filePath;

  const mp3Path = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.mp3`,
  );
  await execa(ffmpeg, ['-i', filePath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-y', mp3Path]);
  if (filePath !== mp3Path) fs.rmSync(filePath, { force: true });
  return mp3Path;
}

export async function processDownload(data: DownloadJobData) {
  const outputDir = path.join(storagePath, 'temp', data.downloadId);
  fs.mkdirSync(outputDir, { recursive: true });

  await prisma.download.update({
    where: { id: data.downloadId },
    data: { status: 'PROCESSING', progress: 10 },
  });

  try {
    const maxHeight = data.plan === 'PRO' ? (data.quality ?? 1080) : Math.min(data.quality ?? 720, 720);
    const heightFallback =
      `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/` +
      `bestvideo[height<=${maxHeight}]+bestaudio/` +
      `best[height<=${maxHeight}][ext=mp4][acodec!=none]/` +
      `best[height<=${maxHeight}]`;
    const videoFormat =
      data.format && data.type !== 'MP3'
        ? `${data.format}+bestaudio/${data.format}/best[format_id=${data.format}]/${heightFallback}`
        : heightFallback;

    const args = [
      data.url,
      '--ffmpeg-location',
      ffmpeg,
      '--js-runtimes',
      'node',
      '-o',
      path.join(outputDir, '%(title).100B.%(ext)s'),
      '-f',
      data.type === 'MP3' ? 'bestaudio/best' : videoFormat,
    ];

    if (data.type === 'MP3') {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-thumbnail');
    } else {
      args.push('--merge-output-format', 'mp4');
    }

    await execa(ytDlp, args);
    await prisma.download.update({
      where: { id: data.downloadId },
      data: { progress: 80 },
    });

    let filePath = pickOutputFile(outputDir, data.type === 'MP3' ? ['mp3'] : []);
    if (!filePath) throw new Error('Download produced no files');
    if (data.type === 'MP3') {
      filePath = await ensureMp3(filePath);
    }

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
