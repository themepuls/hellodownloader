import { Injectable } from '@nestjs/common';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FfmpegService {
  private readonly binary = process.env.FFMPEG_PATH ?? 'ffmpeg';

  async convertToMp3(inputPath: string, outputPath: string): Promise<string> {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await execa(this.binary, [
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      outputPath,
      '-y',
    ]);
    return outputPath;
  }

  async getDuration(filePath: string): Promise<number> {
    const { stdout } = await execa('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    return parseFloat(stdout.trim());
  }

  async mergeAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    await execa(this.binary, [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      outputPath,
      '-y',
    ]);
    return outputPath;
  }
}
