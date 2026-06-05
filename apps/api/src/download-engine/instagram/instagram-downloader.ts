import { Injectable, Logger } from '@nestjs/common';
import { detectPlatform } from '@hellodownloader/shared-types';
import { YtDlpService } from '../../services/yt-dlp.service';

export interface InstagramDownloadOptions {
  type: 'REEL_INSTAGRAM' | 'VIDEO';
  quality?: number;
  outputDir: string;
}

@Injectable()
export class InstagramDownloader {
  private readonly logger = new Logger(InstagramDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  static isInstagramUrl(url: string): boolean {
    return detectPlatform(url) === 'instagram';
  }

  async download(url: string, options: InstagramDownloadOptions): Promise<string> {
    this.logger.log(`Instagram download: type=${options.type} url=${url}`);
    return this.ytDlp.downloadVideo(url, options.outputDir, {
      maxHeight: options.quality ?? 1080,
    });
  }
}
