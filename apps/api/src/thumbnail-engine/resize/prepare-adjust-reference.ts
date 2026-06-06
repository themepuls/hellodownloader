import sharp from '../../utils/load-sharp';
import { resolveThumbnailPixels } from '@hellodownloader/shared-types';
import type { TextRegion } from '../detect/text-detect';

function subjectBoxFromOcr(
  regions: TextRegion[],
  srcW: number,
  srcH: number,
): { x: number; y: number; width: number; height: number } {
  const textRegions = regions.filter((r) => r.confidence >= 20 && r.text.trim().length > 0);

  if (textRegions.length === 0) {
    return {
      x: Math.round(srcW * 0.1),
      y: Math.round(srcH * 0.35),
      width: Math.round(srcW * 0.8),
      height: Math.round(srcH * 0.6),
    };
  }

  let textMaxY = 0;
  for (const r of textRegions) {
    textMaxY = Math.max(textMaxY, r.y + r.height);
  }

  const subjectTop = Math.min(Math.round(srcH * 0.28), Math.max(0, textMaxY - Math.round(srcH * 0.05)));
  return {
    x: 0,
    y: subjectTop,
    width: srcW,
    height: Math.max(Math.round(srcH * 0.45), srcH - subjectTop),
  };
}

/**
 * Build a target-ratio layout guide from the original thumbnail.
 * Subject sits in the lower frame; upper area is open for text overlay.
 * Kontext uses this instead of the raw 16:9 source so Shorts get a real recomposition.
 */
export async function prepareAdjustReferenceImage(input: {
  inputPath: string;
  outputPath: string;
  ratio: string;
  textRegions: TextRegion[];
}): Promise<void> {
  const { width: targetW, height: targetH } = resolveThumbnailPixels(input.ratio);
  const meta = await sharp(input.inputPath).metadata();
  const srcW = meta.width ?? 1280;
  const srcH = meta.height ?? 720;

  const subject = subjectBoxFromOcr(input.textRegions, srcW, srcH);
  const isVertical = targetH > targetW;

  const background = await sharp(input.inputPath)
    .resize(targetW, targetH, { fit: 'cover', position: isVertical ? 'top' : 'centre' })
    .blur(isVertical ? 32 : 20)
    .modulate({ brightness: isVertical ? 0.42 : 0.55, saturation: 1.08 })
    .toBuffer();

  const subjectZoneH = isVertical ? Math.round(targetH * 0.48) : Math.round(targetH * 0.72);
  const subjectZoneW = isVertical ? targetW : Math.round(targetW * 0.55);
  const subjectTop = isVertical ? targetH - subjectZoneH : Math.round((targetH - subjectZoneH) / 2);
  const subjectLeft = isVertical ? 0 : targetW - subjectZoneW;

  const subjectBuffer = await sharp(input.inputPath)
    .extract({
      left: Math.max(0, Math.min(subject.x, srcW - 1)),
      top: Math.max(0, Math.min(subject.y, srcH - 1)),
      width: Math.max(1, Math.min(subject.width, srcW - subject.x)),
      height: Math.max(1, Math.min(subject.height, srcH - subject.y)),
    })
    .resize(subjectZoneW, subjectZoneH, { fit: 'cover', position: 'centre' })
    .sharpen()
    .toBuffer();

  await sharp(background)
    .composite([{ input: subjectBuffer, left: subjectLeft, top: subjectTop }])
    .jpeg({ quality: 92 })
    .toFile(input.outputPath);
}
