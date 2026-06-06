import { Injectable, Logger } from '@nestjs/common';
import { YtDlpService, type PlaylistDownloadOptions } from '../../services/yt-dlp.service';

@Injectable()
export class PlaylistDownloader {
  private readonly logger = new Logger(PlaylistDownloader.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  getEntryCount(url: string) {
    return this.ytDlp.getPlaylistEntryCount(url);
  }

  async download(
    url: string,
    outputDir: string,
    options: PlaylistDownloadOptions = {},
  ): Promise<string[]> {
    this.logger.log(`Playlist download: ${url}`);
    const files = await this.ytDlp.downloadPlaylist(url, outputDir, options);
    if (!files.length) throw new Error('Playlist download produced no files.');
    return files;
  }
}
