import { Injectable } from '@nestjs/common';
import { detectText, TextRegion } from '../thumbnail-engine/detect/text-detect';

@Injectable()
export class OcrService {
  async extractText(imagePath: string): Promise<TextRegion[]> {
    return detectText(imagePath);
  }
}
