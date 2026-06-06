import sharp from '../../utils/load-sharp';
import {
  resolveThumbnailPixels,
  THUMBNAIL_TEXT_EDGE_INSET_PX,
} from '@hellodownloader/shared-types';

const BLOCK_COLORS = ['#FFD700', '#FFFFFF', '#FFFFFF'];
const BLOCK_GAP = 28;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const avgCharWidth = fontSize * 0.54;
  const maxChars = Math.max(8, Math.floor(maxWidth / avgCharWidth));
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textZoneHeight(ratio: string, height: number): number {
  if (ratio === 'SHORTS_9_16' || ratio === 'INSTAGRAM_4_5') {
    return Math.floor(height * 0.52);
  }
  return Math.floor(height * 0.45);
}

function layoutLines(
  blocks: string[],
  width: number,
  height: number,
  ratio: string,
): { lines: Array<{ text: string; fill: string; fontSize: number }>; fontSize: number } {
  const inset = THUMBNAIL_TEXT_EDGE_INSET_PX;
  const maxWidth = width - inset * 2;
  const zoneH = textZoneHeight(ratio, height) - inset;

  for (let fontSize = 64; fontSize >= 32; fontSize -= 4) {
    const lineHeight = Math.round(fontSize * 1.12);
    const laidOut: Array<{ text: string; fill: string; fontSize: number }> = [];
    let used = 0;

    for (let b = 0; b < blocks.length; b++) {
      if (b > 0) used += BLOCK_GAP;
      const wrapped = wrapText(blocks[b]!, maxWidth, fontSize);
      for (const line of wrapped) {
        if (used + lineHeight > zoneH) {
          break;
        }
        laidOut.push({ text: line, fill: BLOCK_COLORS[b] ?? '#FFFFFF', fontSize });
        used += lineHeight;
      }
      if (used + lineHeight > zoneH && laidOut.length > 0) break;
    }

    if (laidOut.length > 0 && used <= zoneH) {
      return { lines: laidOut, fontSize };
    }
  }

  const fontSize = 32;
  const lines = blocks.flatMap((block, b) =>
    wrapText(block, maxWidth, fontSize).map((text) => ({
      text,
      fill: BLOCK_COLORS[b] ?? '#FFFFFF',
      fontSize,
    })),
  );
  return { lines: lines.slice(0, 12), fontSize };
}

function displayText(text: string): string {
  if (/[\u0980-\u09FF]/.test(text)) return text;
  if (/[a-zA-Z]/.test(text)) return text.toUpperCase();
  return text;
}

function buildTextSvg(
  width: number,
  height: number,
  lines: Array<{ text: string; fill: string; fontSize: number }>,
): string {
  const inset = THUMBNAIL_TEXT_EDGE_INSET_PX;
  const topInset = inset + 6;
  let y = topInset;
  const textElements: string[] = [];

  for (const line of lines) {
    const lineHeight = Math.round(line.fontSize * 1.12);
    const safe = escapeXml(displayText(line.text));
    const strokeW = Math.max(2, Math.round(line.fontSize / 14));
    textElements.push(`
      <text x="${inset}" y="${y}" dominant-baseline="hanging"
        font-family="Arial Black, Impact, Helvetica, sans-serif"
        font-size="${line.fontSize}" font-weight="900" fill="${line.fill}"
        stroke="#000000" stroke-width="${strokeW}"
        paint-order="stroke fill" letter-spacing="0.5">${safe}</text>`);
    y += lineHeight;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${textElements.join('\n')}
  </svg>`;
}

/** Composite OCR text with exact ${THUMBNAIL_TEXT_EDGE_INSET_PX}px inset from top/left/right. */
export async function renderAdjustTextOverlay(input: {
  inputPath: string;
  outputPath: string;
  ratio: string;
  blocks: string[];
}): Promise<void> {
  if (input.blocks.length === 0) {
    await sharp(input.inputPath)
      .resize(resolveThumbnailPixels(input.ratio).width, resolveThumbnailPixels(input.ratio).height, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 94 })
      .toFile(input.outputPath);
    return;
  }

  const { width, height } = resolveThumbnailPixels(input.ratio);
  const isVertical = height > width;

  const meta = await sharp(input.inputPath).metadata();
  const srcW = meta.width ?? width;
  const srcH = meta.height ?? height;

  const normalized =
    srcW === width && srcH === height
      ? await sharp(input.inputPath).jpeg({ quality: 94 }).toBuffer()
      : await sharp(input.inputPath)
          .resize(width, height, {
            fit: 'cover',
            position: isVertical ? 'bottom' : 'centre',
          })
          .jpeg({ quality: 94 })
          .toBuffer();

  const { lines } = layoutLines(input.blocks, width, height, input.ratio);
  if (lines.length === 0) {
    await sharp(normalized).jpeg({ quality: 94 }).toFile(input.outputPath);
    return;
  }

  const svg = buildTextSvg(width, height, lines);
  const svgBuffer = Buffer.from(svg);

  await sharp(normalized)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toFile(input.outputPath);
}
