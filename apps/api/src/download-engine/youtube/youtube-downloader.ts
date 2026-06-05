import { Injectable, Logger } from '@nestjs/common';
import { YtDlpService } from '../../services/yt-dlp.service';

export interface YouTubeDownloadOptions {
  type: 'VIDEO' | 'SHORTS' | 'MP3' | 'SUBTITLE' | 'PLAYLIST';
  quality?: number;
  format?: string;
  outputDir: string;
}

export interface YouTubeDownloadResult {
  filePaths: string[];
  primary: string;
}

@Injectable()
export class YouTubeDownloader {
  private readonly logger = new Logger(YouTubeDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  static isYouTubeUrl(url: string): boolean {
    return /youtube\.com|youtu\.be/i.test(url);
  }

  async download(url: string, options: YouTubeDownloadOptions): Promise<YouTubeDownloadResult> {
    this.logger.log(`YouTube download: type=${options.type} url=${url}`);

    switch (options.type) {
      case 'MP3': {
        const filePath = await this.ytDlp.downloadVideo(url, options.outputDir, {
          audioOnly: true,
        });
        return { filePaths: [filePath], primary: filePath };
      }

      case 'SUBTITLE': {
        const filePaths = await this.ytDlp.downloadSubtitles(url, options.outputDir);
        if (!filePaths.length) throw new Error('No subtitles found for this video.');
        return { filePaths, primary: filePaths[0] };
      }

      case 'PLAYLIST': {
        const filePaths = await this.ytDlp.downloadPlaylist(url, options.outputDir, options.quality);
        if (!filePaths.length) throw new Error('Playlist download produced no files.');
        return { filePaths, primary: filePaths[0] };
      }

      case 'VIDEO':
      case 'SHORTS':
      default: {
        const filePath = await this.ytDlp.downloadVideo(url, options.outputDir, {
          maxHeight: options.quality,
          format: options.format,
        });
        return { filePaths: [filePath], primary: filePath };
      }
    }
  }
}
