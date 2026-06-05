import { Injectable, Logger } from '@nestjs/common';
import { YtDlpService } from '../../services/yt-dlp.service';

@Injectable()
export class PlaylistDownloader {
  private readonly logger = new Logger(PlaylistDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  async download(url: string, outputDir: string, maxHeight?: number): Promise<string[]> {
    this.logger.log(`Playlist download: ${url}`);
    const files = await this.ytDlp.downloadPlaylist(url, outputDir, maxHeight);
    if (!files.length) throw new Error('Playlist download produced no files.');
    return files;
  }
}
