import sharp from 'sharp';

export interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lightweight face region estimator using brightness hotspot analysis.
 * For production accuracy, replace with a proper ML model (e.g., face-api.js).
 * Returns the brightest quadrant as a heuristic face anchor for crop positioning.
 */
export async function detectFaces(imagePath: string): Promise<FaceRegion[]> {
  const { data, info } = await sharp(imagePath)
    .resize(100, 100, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const half = Math.floor(w / 2);

  // Split into quadrants and find brightest (likely face area)
  const quadrantSums: { q: number; sum: number }[] = [
    { q: 0, sum: 0 }, // top-left
    { q: 1, sum: 0 }, // top-right
    { q: 2, sum: 0 }, // bottom-left
    { q: 3, sum: 0 }, // bottom-right
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const brightness = data[y * w + x];
      const q = (x >= half ? 1 : 0) + (y >= Math.floor(h / 2) ? 2 : 0);
      quadrantSums[q].sum += brightness;
    }
  }

  const brightest = quadrantSums.sort((a, b) => b.sum - a.sum)[0].q;
  const qx = (brightest & 1) * half;
  const qy = ((brightest >> 1) & 1) * Math.floor(h / 2);

  // Scale back to original dimensions
  const meta = await sharp(imagePath).metadata();
  const scaleX = (meta.width ?? w) / w;
  const scaleY = (meta.height ?? h) / h;

  return [
    {
      x: Math.round(qx * scaleX),
      y: Math.round(qy * scaleY),
      width: Math.round(half * scaleX),
      height: Math.round(Math.floor(h / 2) * scaleY),
    },
  ];
}
