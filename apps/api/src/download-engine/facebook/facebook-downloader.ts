import { Injectable, Logger } from '@nestjs/common';
import { detectPlatform } from '@hellodownloader/shared-types';
import { YtDlpService } from '../../services/yt-dlp.service';

export interface FacebookDownloadOptions {
  type: 'REEL_FACEBOOK' | 'VIDEO';
  quality?: number;
  format?: string;
  outputDir: string;
}

@Injectable()
export class FacebookDownloader {
  private readonly logger = new Logger(FacebookDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  static isFacebookUrl(url: string): boolean {
    return detectPlatform(url) === 'facebook';
  }

  async download(url: string, options: FacebookDownloadOptions): Promise<string> {
    this.logger.log(`Facebook download: type=${options.type} url=${url}`);
    return this.ytDlp.downloadVideo(url, options.outputDir, {
      maxHeight: options.quality ?? 1080,
      format: options.format,
      url,
    });
  }
}
