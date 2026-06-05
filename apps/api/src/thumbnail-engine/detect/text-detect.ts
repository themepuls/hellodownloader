import { createWorker } from 'tesseract.js';

export interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/** OCR text regions from original thumbnail — used to reposition, not regenerate. */
export async function detectText(imagePath: string): Promise<TextRegion[]> {
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  return (data.words ?? [])
    .filter((w) => (w.confidence ?? 0) > 60)
    .map((w) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      confidence: w.confidence ?? 0,
    }));
}
