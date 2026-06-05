import { Injectable, Logger } from '@nestjs/common';
import { YtDlpService, type DownloadOptions } from '../../services/yt-dlp.service';

@Injectable()
export class Mp3Converter {
  private readonly logger = new Logger(Mp3Converter.name);

  constructor(private readonly ytDlp: YtDlpService) {}

  async convert(
    url: string,
    outputDir: string,
    options: Pick<DownloadOptions, 'onProgress' | 'durationSeconds'> = {},
  ): Promise<string> {
    this.logger.log(`MP3 conversion: ${url}`);
    return this.ytDlp.downloadVideo(url, outputDir, { audioOnly: true, ...options });
  }
}
