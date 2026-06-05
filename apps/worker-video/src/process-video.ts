import { execa } from 'execa';
import { PrismaClient } from '@hellodownloader/database';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';

export type VideoOperation = 'mp3' | 'merge' | 'transcode' | 'extract_audio';

export interface VideoJobData {
  downloadId: string;
  inputPath: string;
  operation: VideoOperation;
  outputPath?: string;
  audioPath?: string;
  targetFormat?: string;
  targetHeight?: number;
}

export async function processVideo(data: VideoJobData): Promise<string> {
  const { downloadId, inputPath, operation } = data;

  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'PROCESSING', progress: 50 },
  });

  let outputPath: string;

  try {
    switch (operation) {
      case 'mp3': {
        outputPath = data.outputPath ?? inputPath.replace(/\.[^.]+$/, '.mp3');
        await execa(ffmpeg, [
          '-i', inputPath,
          '-vn',
          '-acodec', 'libmp3lame',
          '-q:a', '2',
          '-y',
          outputPath,
        ]);
        break;
      }

      case 'extract_audio': {
        outputPath = data.outputPath ?? inputPath.replace(/\.[^.]+$/, '_audio.aac');
        await execa(ffmpeg, [
          '-i', inputPath,
          '-vn',
          '-acodec', 'copy',
          '-y',
          outputPath,
        ]);
        break;
      }

      case 'merge': {
        // Merge separate video + audio streams into single mp4
        const audioPath = data.audioPath;
        if (!audioPath || !fs.existsSync(audioPath)) {
          throw new Error('audioPath is required and must exist for merge operation');
        }
        outputPath = data.outputPath ?? inputPath.replace(/\.[^.]+$/, '_merged.mp4');
        await execa(ffmpeg, [
          '-i', inputPath,
          '-i', audioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-movflags', '+faststart',
          '-y',
          outputPath,
        ]);
        break;
      }

      case 'transcode': {
        const height = data.targetHeight ?? 720;
        const format = data.targetFormat ?? 'mp4';
        const ext = format === 'webm' ? 'webm' : 'mp4';
        const codec = format === 'webm' ? 'libvpx-vp9' : 'libx264';
        outputPath = data.outputPath ?? inputPath.replace(/\.[^.]+$/, `_${height}p.${ext}`);

        await execa(ffmpeg, [
          '-i', inputPath,
          '-vf', `scale=-2:${height}`,
          '-c:v', codec,
          '-crf', '23',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-y',
          outputPath,
        ]);
        break;
      }

      default:
        throw new Error(`Unknown video operation: ${String(operation)}`);
    }

    const stat = fs.statSync(outputPath);
    await prisma.download.update({
      where: { id: downloadId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        filePath: outputPath,
        fileSize: BigInt(stat.size),
        completedAt: new Date(),
      },
    });

    return outputPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video processing failed';
    await prisma.download.update({
      where: { id: downloadId },
      data: { status: 'FAILED', error: message, progress: 0 },
    });
    throw err;
  }
}

// Utility: get video duration in seconds via ffprobe
export async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execa('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

// Utility: generate thumbnail from video at given timestamp
export async function generateVideoThumbnail(
  videoPath: string,
  outputPath: string,
  atSecond = 5,
): Promise<string> {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  await execa(ffmpeg, [
    '-ss', atSecond.toString(),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    '-y',
    outputPath,
  ]);
  return outputPath;
}
