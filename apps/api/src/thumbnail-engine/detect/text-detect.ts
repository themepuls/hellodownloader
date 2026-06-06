import { createWorker } from 'tesseract.js';
import {
  detectAdjustOcrScript,
  normalizeAdjustOcrLines,
} from '@hellodownloader/shared-types';

export interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export type OcrAdjustResult = {
  regions: TextRegion[];
  lines: string[];
  fullText: string;
};

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

async function recognizeWithLang(
  imagePath: string,
  langs: string | string[],
): Promise<OcrAdjustResult> {
  const worker = await createWorker(langs);
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  const regions = (data.words ?? [])
    .filter((w) => (w.confidence ?? 0) > 20 && w.text?.trim())
    .map(mapWord);

  const lineTexts = (data.lines ?? [])
    .map((l) => l.text?.trim())
    .filter(Boolean) as string[];

  const blockTexts = (data.blocks ?? [])
    .map((b) => b.text?.trim())
    .filter(Boolean) as string[];

  const lines =
    lineTexts.length > 0
      ? lineTexts
      : blockTexts.length > 0
        ? blockTexts
        : regions.map((r) => r.text.trim()).filter(Boolean);

  const fullText = (data.text ?? lines.join('\n')).trim();

  return { regions, lines, fullText };
}

function finalizeOcrResult(result: OcrAdjustResult): OcrAdjustResult {
  const normalized = normalizeAdjustOcrLines(result.lines, result.fullText);
  return {
    regions: result.regions,
    lines: normalized.lines,
    fullText: normalized.fullText,
  };
}

/** OCR text regions from original thumbnail — used to reposition, not regenerate. */
export async function detectText(imagePath: string): Promise<TextRegion[]> {
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(imagePath);
  await worker.terminate();

  return (data.words ?? [])
    .filter((w) => (w.confidence ?? 0) > 60)
    .map(mapWord);
}

/**
 * OCR for AI Adjust — runs English and Bengali separately (never combined).
 * Combined eng+ben makes Tesseract misread English as Bengali script.
 */
export async function detectTextForAdjust(imagePath: string): Promise<OcrAdjustResult> {
  const eng = await recognizeWithLang(imagePath, 'eng');
  const engScript = detectAdjustOcrScript(eng.fullText);

  if (engScript === 'latin' && eng.fullText.length >= 8) {
    return finalizeOcrResult(eng);
  }

  try {
    const ben = await recognizeWithLang(imagePath, 'ben');
    const benScript = detectAdjustOcrScript(ben.fullText);
    const engBengali = (eng.fullText.match(/[\u0980-\u09FF]/g) ?? []).length;
    const benBengali = (ben.fullText.match(/[\u0980-\u09FF]/g) ?? []).length;

    if (benScript === 'bengali' && benBengali >= engBengali && ben.fullText.length >= 8) {
      return finalizeOcrResult(ben);
    }
  } catch {
    // Bengali pack unavailable — English result is fine.
  }

  return finalizeOcrResult(eng);
}
