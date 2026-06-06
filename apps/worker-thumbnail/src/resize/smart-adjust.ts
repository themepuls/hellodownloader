import sharp = require('sharp');
import type { TextRegion } from '../detect/text-detect';

export type TargetSize = { width: number; height: number };

const PADDING_RATIO = 0.06;
const RATIO_CHANGE_THRESHOLD = 0.08;

function computeContentBox(
  regions: TextRegion[],
  srcW: number,
  srcH: number,
): { x: number; y: number; width: number; height: number } {
  const confident = regions.filter((r) => r.confidence >= 20 && r.text.trim().length > 0);

  if (confident.length === 0) {
    return { x: 0, y: 0, width: srcW, height: srcH };
  }

  let minX = srcW;
  let minY = srcH;
  let maxX = 0;
  let maxY = 0;

  for (const r of confident) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  if (maxX - minX < srcW * 0.55) {
    minX = 0;
    maxX = srcW;
  }
  if (maxY - minY < srcH * 0.45) {
    minY = 0;
    maxY = srcH;
  }

  const padX = Math.round((maxX - minX) * PADDING_RATIO + srcW * 0.02);
  const padY = Math.round((maxY - minY) * PADDING_RATIO + srcH * 0.02);

  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const width = Math.min(srcW - x, maxX - minX + padX * 2);
  const height = Math.min(srcH - y, maxY - minY + padY * 2);

  return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
}

function clampOffset(offset: number, canvas: number, content: number): number {
  if (content >= canvas) return 0;
  return Math.max(0, Math.min(offset, canvas - content));
}

async function resizeWithBlurBackground(
  inputPath: string,
  outputPath: string,
  targetW: number,
  targetH: number,
  contentBox: { x: number; y: number; width: number; height: number },
  srcW: number,
  srcH: number,
): Promise<void> {
  const scale = Math.min(targetW / srcW, targetH / srcH);
  const fgW = Math.max(1, Math.round(srcW * scale));
  const fgH = Math.max(1, Math.round(srcH * scale));

  const contentCx = contentBox.x + contentBox.width / 2;
  const contentCy = contentBox.y + contentBox.height / 2;
  const scaledCx = contentCx * scale;
  const scaledCy = contentCy * scale;

  const offsetX = clampOffset(Math.round(targetW / 2 - scaledCx), targetW, fgW);
  const offsetY = clampOffset(Math.round(targetH / 2 - scaledCy), targetH, fgH);

  const background = await sharp(inputPath)
    .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
    .blur(28)
    .modulate({ brightness: 0.5, saturation: 1.05 })
    .toBuffer();

  const foreground = await sharp(inputPath)
    .resize(fgW, fgH, { fit: 'fill' })
    .sharpen()
    .toBuffer();

  await sharp(background)
    .composite([{ input: foreground, left: offsetX, top: offsetY }])
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

async function resizeSmartCover(
  inputPath: string,
  outputPath: string,
  targetW: number,
  targetH: number,
  contentBox: { x: number; y: number; width: number; height: number },
  srcW: number,
  srcH: number,
): Promise<void> {
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const cropW = Math.min(srcW, Math.round(targetW / scale));
  const cropH = Math.min(srcH, Math.round(targetH / scale));

  const marginX = Math.round(cropW * 0.04);
  const marginY = Math.round(cropH * 0.04);

  let left = Math.round(contentBox.x + contentBox.width / 2 - cropW / 2);
  let top = Math.round(contentBox.y + contentBox.height / 2 - cropH / 2);

  left = Math.max(0, Math.min(left, srcW - cropW));
  top = Math.max(0, Math.min(top, srcH - cropH));

  if (contentBox.x + contentBox.width > left + cropW - marginX) {
    left = Math.max(0, contentBox.x + contentBox.width - cropW + marginX);
  }
  if (contentBox.x < left + marginX) {
    left = Math.min(srcW - cropW, Math.max(0, contentBox.x - marginX));
  }
  if (contentBox.y + contentBox.height > top + cropH - marginY) {
    top = Math.max(0, contentBox.y + contentBox.height - cropH + marginY);
  }
  if (contentBox.y < top + marginY) {
    top = Math.min(srcH - cropH, Math.max(0, contentBox.y - marginY));
  }

  await sharp(inputPath)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(targetW, targetH, { fit: 'fill' })
    .sharpen()
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

export async function smartAdjustResize(
  inputPath: string,
  outputPath: string,
  target: TargetSize,
  textRegions: TextRegion[],
): Promise<{ scaledRegions: TextRegion[] }> {
  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width ?? 1280;
  const srcH = meta.height ?? 720;
  const targetW = target.width;
  const targetH = target.height;

  const contentBox = computeContentBox(textRegions, srcW, srcH);
  const srcRatio = srcW / srcH;
  const targetRatio = targetW / targetH;
  const ratioDelta = Math.abs(srcRatio - targetRatio) / Math.max(targetRatio, 0.01);

  const contentSpansMostOfFrame =
    contentBox.width / srcW > 0.85 && contentBox.height / srcH > 0.85;

  if (ratioDelta > RATIO_CHANGE_THRESHOLD || contentSpansMostOfFrame) {
    await resizeWithBlurBackground(inputPath, outputPath, targetW, targetH, contentBox, srcW, srcH);
  } else {
    await resizeSmartCover(inputPath, outputPath, targetW, targetH, contentBox, srcW, srcH);
  }

  const scale = Math.min(targetW / srcW, targetH / srcH);
  const fgW = Math.round(srcW * scale);
  const fgH = Math.round(srcH * scale);
  const usedContain = ratioDelta > RATIO_CHANGE_THRESHOLD || contentSpansMostOfFrame;

  const offsetX = usedContain
    ? clampOffset(
        Math.round(targetW / 2 - (contentBox.x + contentBox.width / 2) * scale),
        targetW,
        fgW,
      )
    : 0;
  const offsetY = usedContain
    ? clampOffset(
        Math.round(targetH / 2 - (contentBox.y + contentBox.height / 2) * scale),
        targetH,
        fgH,
      )
    : 0;

  const mapScale = usedContain ? scale : Math.max(targetW / srcW, targetH / srcH);
  const mapOffsetX = usedContain ? offsetX : 0;
  const mapOffsetY = usedContain ? offsetY : 0;

  const scaledRegions = textRegions.map((r) => ({
    ...r,
    x: Math.round(r.x * mapScale + mapOffsetX),
    y: Math.round(r.y * mapScale + mapOffsetY),
    width: Math.round(r.width * mapScale),
    height: Math.round(r.height * mapScale),
  }));

  return { scaledRegions };
}
