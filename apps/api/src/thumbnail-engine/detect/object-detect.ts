import sharp from 'sharp';

export interface ObjectRegion {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Contrast-based region detector used as a lightweight object proxy.
 * Identifies high-contrast areas which typically correspond to key visual subjects.
 * For production, replace with ONNX/TensorFlow.js model inference.
 */
export async function detectObjects(imagePath: string): Promise<ObjectRegion[]> {
  const meta = await sharp(imagePath).metadata();
  const srcW = meta.width ?? 1280;
  const srcH = meta.height ?? 720;

  const { data, info } = await sharp(imagePath)
    .resize(64, 64, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const scaleX = srcW / w;
  const scaleY = srcH / h;

  // Find pixels with high local contrast
  const highContrast: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const center = data[y * w + x];
      const neighbors = [
        data[(y - 1) * w + x],
        data[(y + 1) * w + x],
        data[y * w + (x - 1)],
        data[y * w + (x + 1)],
      ];
      const maxDiff = Math.max(...neighbors.map((n) => Math.abs(n - center)));
      if (maxDiff > 60) highContrast.push({ x, y });
    }
  }

  if (!highContrast.length) return [];

  const minX = Math.min(...highContrast.map((p) => p.x));
  const minY = Math.min(...highContrast.map((p) => p.y));
  const maxX = Math.max(...highContrast.map((p) => p.x));
  const maxY = Math.max(...highContrast.map((p) => p.y));

  return [
    {
      label: 'subject',
      x: Math.round(minX * scaleX),
      y: Math.round(minY * scaleY),
      width: Math.round((maxX - minX) * scaleX),
      height: Math.round((maxY - minY) * scaleY),
      confidence: 0.7,
    },
  ];
}
