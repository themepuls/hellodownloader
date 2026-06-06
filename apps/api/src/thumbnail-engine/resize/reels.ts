import type { TextRegion } from '../detect/text-detect';
import { smartAdjustResize } from './smart-adjust';

const TARGET = { width: 1080, height: 1080 };

export async function resizeFacebook1x1(
  inputPath: string,
  outputPath: string,
  textRegions: TextRegion[],
): Promise<{ outputPath: string; scaledRegions: TextRegion[] }> {
  const { scaledRegions } = await smartAdjustResize(inputPath, outputPath, TARGET, textRegions);
  return { outputPath, scaledRegions };
}
