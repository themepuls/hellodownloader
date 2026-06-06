import { createWorker } from 'tesseract.js';

export interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

function mapWord(w: {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}): TextRegion {
  return {
    text: w.text,
    x: w.bbox.x0,
    y: w.bbox.y0,
    width: w.bbox.x1 - w.bbox.x0,
    height: w.bbox.y1 - w.bbox.y0,
    confidence: w.confidence ?? 0,
  };
}

export async function detectTextForAdjust(imagePath: string): Promise<TextRegion[]> {
  let worker;
  try {
    worker = await createWorker(['eng', 'ben']);
  } catch {
    worker = await createWorker('eng');
  }

  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  const words = (data.words ?? [])
    .filter((w) => (w.confidence ?? 0) > 20 && w.text?.trim())
    .map(mapWord);

  if (words.length >= 2) return words;

  const lines = (data.lines ?? [])
    .filter((l) => l.text?.trim())
    .map((l) => ({
      text: l.text,
      x: l.bbox.x0,
      y: l.bbox.y0,
      width: l.bbox.x1 - l.bbox.x0,
      height: l.bbox.y1 - l.bbox.y0,
      confidence: 55,
    }));

  if (lines.length > 0) return lines;

  const blocks = (data.blocks ?? [])
    .filter((b) => b.text?.trim())
    .map((b) => ({
      text: b.text,
      x: b.bbox.x0,
      y: b.bbox.y0,
      width: b.bbox.x1 - b.bbox.x0,
      height: b.bbox.y1 - b.bbox.y0,
      confidence: 50,
    }));

  return blocks.length > 0 ? blocks : words;
}
