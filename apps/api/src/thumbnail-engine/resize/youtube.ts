import sharp from 'sharp';
import type { TextRegion } from '../detect/text-detect';

const TARGET = { width: 1280, height: 720 };

/** Resize original thumbnail to 16:9 preserving content; text regions scaled proportionally. */
export async function resizeYouTube16x9(
  inputPath: string,
  outputPath: string,
  textRegions: TextRegion[],
): Promise<{ outputPath: string; scaledRegions: TextRegion[] }> {
  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width ?? 1280;
  const srcH = meta.height ?? 720;

  await sharp(inputPath)
    .resize(TARGET.width, TARGET.height, { fit: 'cover', position: 'centre' })
    .sharpen()
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  const scaleX = TARGET.width / srcW;
  const scaleY = TARGET.height / srcH;

  const scaledRegions = textRegions.map((r) => ({
    ...r,
    x: Math.round(r.x * scaleX),
    y: Math.round(r.y * scaleY),
    width: Math.round(r.width * scaleX),
    height: Math.round(r.height * scaleY),
  }));

  return { outputPath, scaledRegions };
}
