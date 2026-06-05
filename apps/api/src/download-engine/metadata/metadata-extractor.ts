import { Injectable } from '@nestjs/common';
import { detectPlatform, type VideoPlatform } from '@hellodownloader/shared-types';
import { YtDlpService, VideoMetadata } from '../../services/yt-dlp.service';

@Injectable()
export class MetadataExtractor {
  constructor(private readonly ytDlp: YtDlpService) {}

  async extract(url: string): Promise<VideoMetadata> {
    return this.ytDlp.extractMetadata(url);
  }

  detectPlatform(url: string): VideoPlatform {
    return detectPlatform(url);
  }
}
