import { Injectable, Logger } from '@nestjs/common';
import { YtDlpService } from '../../services/yt-dlp.service';

@Injectable()
export class SubtitleDownloader {
  private readonly logger = new Logger(SubtitleDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  async download(url: string, outputDir: string): Promise<string[]> {
    this.logger.log(`Subtitle download: ${url}`);
    const files = await this.ytDlp.downloadSubtitles(url, outputDir);
    if (!files.length) throw new Error('No subtitles found for this video.');
    return files;
  }
}
