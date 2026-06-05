import sharp from 'sharp';
import type { TextRegion } from '../detect/text-detect';

const TARGET = { width: 1080, height: 1350 }; // 4:5 ratio

export async function resizeInstagram4x5(
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

  return {
    outputPath,
    scaledRegions: textRegions.map((r) => ({
      ...r,
      x: Math.round(r.x * scaleX),
      y: Math.round(r.y * scaleY),
      width: Math.round(r.width * scaleX),
      height: Math.round(r.height * scaleY),
    })),
  };
}
