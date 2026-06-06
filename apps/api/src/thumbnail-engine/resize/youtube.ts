import type { TextRegion } from '../detect/text-detect';
import { smartAdjustResize } from './smart-adjust';

const TARGET = { width: 1280, height: 720 };

export async function resizeYouTube16x9(
  inputPath: string,
  outputPath: string,
  textRegions: TextRegion[],
): Promise<{ outputPath: string; scaledRegions: TextRegion[] }> {
  const { scaledRegions } = await smartAdjustResize(inputPath, outputPath, TARGET, textRegions);
  return { outputPath, scaledRegions };
}
