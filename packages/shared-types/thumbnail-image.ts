import { resolveThumbnailRatioLabel } from './thumbnail-prompts';

export const THUMBNAIL_RATIO_TO_FAL: Record<string, string> = {
  YOUTUBE_16_9: '16:9',
  SHORTS_9_16: '9:16',
  INSTAGRAM_4_5: '3:4',
  FACEBOOK_1_1: '1:1',
};

export const THUMBNAIL_RATIO_TO_PIXELS: Record<string, { width: number; height: number }> = {
  YOUTUBE_16_9: { width: 1280, height: 720 },
  SHORTS_9_16: { width: 1080, height: 1920 },
  INSTAGRAM_4_5: { width: 1080, height: 1350 },
  FACEBOOK_1_1: { width: 1080, height: 1080 },
};

/** OpenAI gpt-image-1 supported sizes */
export const THUMBNAIL_RATIO_TO_OPENAI_SIZE: Record<string, string> = {
  YOUTUBE_16_9: '1536x1024',
  SHORTS_9_16: '1024x1536',
  INSTAGRAM_4_5: '1024x1536',
  FACEBOOK_1_1: '1024x1024',
};

export type AdjustTextLayout = {
  blocks: string[];
  layoutHint: string;
  condensed: boolean;
};

/** Minimum inset for overlay text from all frame edges (px at export resolution). */
export const THUMBNAIL_TEXT_EDGE_INSET_PX = 10;

export function thumbnailTextSafeZoneRule(ratio: string): string {
  const px = THUMBNAIL_TEXT_EDGE_INSET_PX;
  const dims = resolveThumbnailPixels(ratio);
  return `TEXT SAFE ZONE (mandatory — ${dims.width}×${dims.height}px canvas):
- Inset ALL text at least ${px}px from the left, right, top, and bottom edges.
- Left-align text blocks with ${px}px left padding — never flush against the left border.
- Wrap lines so no letter crosses the right margin (max x ≤ ${dims.width - px}px).
- Scale font down if needed; never clip or cut off characters at any edge.`;
}

export function resolveFalAspectRatio(ratio: string): string {
  return THUMBNAIL_RATIO_TO_FAL[ratio] ?? '16:9';
}

export function resolveOpenAiImageSize(ratio: string): string {
  return THUMBNAIL_RATIO_TO_OPENAI_SIZE[ratio] ?? '1024x1024';
}

export function resolveThumbnailPixels(ratio: string): { width: number; height: number } {
  return THUMBNAIL_RATIO_TO_PIXELS[ratio] ?? THUMBNAIL_RATIO_TO_PIXELS.YOUTUBE_16_9;
}

export function resolveFalImageEndpoint(
  model: string,
  mode: 'adjust' | 'generate',
  plan?: 'FREE' | 'PRO',
): string {
  if (mode === 'adjust') {
    if (plan === 'PRO' || model === 'flux-kontext-pro' || model === 'flux-pro') {
      return 'fal-ai/flux-pro/kontext/max';
    }
    return 'fal-ai/flux-pro/kontext';
  }
  if (model === 'flux-kontext-pro') {
    return 'fal-ai/flux-pro/kontext/text-to-image';
  }
  if (model === 'flux-pro') {
    return 'fal-ai/flux-pro';
  }
  if (model === 'flux-schnell') {
    return 'fal-ai/flux/schnell';
  }
  return 'fal-ai/flux/dev';
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const BENGALI_SCRIPT_RE = /[\u0980-\u09FF]/g;
const LATIN_LETTER_RE = /[A-Za-z]/g;

export type AdjustOcrScript = 'latin' | 'bengali' | 'mixed';

function countScriptChars(text: string): { latin: number; bengali: number } {
  return {
    latin: (text.match(LATIN_LETTER_RE) ?? []).length,
    bengali: (text.match(BENGALI_SCRIPT_RE) ?? []).length,
  };
}

/** Detect dominant script — mixed eng+ben OCR often injects Bengali into English text. */
export function detectAdjustOcrScript(text: string): AdjustOcrScript {
  const { latin, bengali } = countScriptChars(text);
  const letters = latin + bengali;
  if (letters === 0) return 'latin';
  const bengaliShare = bengali / letters;
  if (bengaliShare >= 0.35 && bengali >= latin) return 'bengali';
  if (bengaliShare >= 0.15 && bengaliShare < 0.35) return 'mixed';
  return 'latin';
}

/** Strip OCR noise and wrong-script characters before overlay. */
export function sanitizeAdjustOcrText(text: string, script: AdjustOcrScript = 'latin'): string {
  let cleaned = text
    .replace(/\|[\s|]*/g, ' ')
    .replace(/\\+/g, ' ')
    .replace(/[<>{}[\]`~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (script === 'latin') {
    cleaned = cleaned
      .replace(/[\u0980-\u09FF]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return cleaned;
}

export function normalizeAdjustOcrLines(
  lines: string[],
  fullOcrText?: string,
): { lines: string[]; fullText: string; script: AdjustOcrScript } {
  const rawCombined = (fullOcrText ?? lines.join(' ')).replace(/\s+/g, ' ').trim();
  const script = detectAdjustOcrScript(rawCombined);

  const cleanedLines = lines
    .map((line) => sanitizeAdjustOcrText(line.trim(), script))
    .filter((line) => line.replace(/[^A-Za-z\u0980-\u09FF0-9]/g, '').length >= 3);

  const fullText = sanitizeAdjustOcrText(rawCombined, script);

  return {
    lines: cleanedLines.length > 0 ? cleanedLines : fullText ? [fullText] : [],
    fullText,
    script,
  };
}

function layoutHintForRatio(ratio: string): string {
  switch (ratio) {
    case 'SHORTS_9_16':
      return `Vertical Shorts layout (1080×1920):
- Upper 55%: 2–3 bold text blocks (stacked), large readable type, high contrast.
- Lower 45%: main subject/face, fully visible, never covered by text.
- Alternate text colors (yellow/gold + white) like viral story thumbnails.
- Cinematic background blur behind text area.
- Text area: left-aligned with ${THUMBNAIL_TEXT_EDGE_INSET_PX}px inset on every side.`;
    case 'INSTAGRAM_4_5':
      return `Instagram 4:5 layout: subject centered-bottom, 2 text blocks above, clean margins.`;
    case 'FACEBOOK_1_1':
      return `Square layout: subject right or center, text blocks left, balanced composition.`;
    default:
      return `YouTube 16:9 layout: subject on one side, 2–3 text blocks on the other, strong hierarchy.`;
  }
}

/** Restructure long OCR into max 3 thumbnail text blocks (local heuristic fallback). */
export function structureAdjustTextBlocks(
  lines: string[],
  fullOcrText: string | undefined,
  ratio: string,
): AdjustTextLayout {
  const normalized = normalizeAdjustOcrLines(lines, fullOcrText);
  const rawLines = normalized.lines;
  const combined = normalized.fullText;
  const layoutHint = layoutHintForRatio(ratio);

  if (!combined) {
    return { blocks: [], layoutHint, condensed: false };
  }

  const needsCondense = combined.length > 320 || rawLines.length > 4;

  if (!needsCondense) {
    return {
      blocks: rawLines.slice(0, 3),
      layoutHint,
      condensed: false,
    };
  }

  const sentences = splitSentences(combined);
  if (sentences.length <= 3) {
    return { blocks: sentences.slice(0, 3), layoutHint, condensed: true };
  }

  const third = Math.ceil(sentences.length / 3);
  const blocks = [
    sentences.slice(0, third).join(' '),
    sentences.slice(third, third * 2).join(' '),
    sentences.slice(third * 2).join(' '),
  ]
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 3);

  return { blocks, layoutHint, condensed: true };
}

/** AI generates subject/background only — text is composited in code with exact px margins. */
export function buildAdjustBackgroundPrompt(input: {
  adminPrompt: string;
  ratio: string;
  layoutHint: string;
  recomposing?: boolean;
}): string {
  const ratioLabel = resolveThumbnailRatioLabel(input.ratio);
  const recomposeNote = input.recomposing
    ? `RECOMPOSE for ${ratioLabel} — this is a layout guide, NOT the final crop. Transform it into a fresh photorealistic thumbnail:
- Expand/rebuild the scene for the target aspect ratio (do NOT letterbox or center-crop the guide).
- Subject/face anchored in the LOWER portion; upper 50% = soft cinematic background only (no faces).
- Remove any leftover text artifacts from the guide completely.`
    : '';

  return `${input.adminPrompt.trim()}

CRITICAL: Do NOT include ANY text, words, letters, numbers, captions, logos, or typography in the output image. Text is added separately in post-production.

TASK: Create a premium ${ratioLabel} YouTube thumbnail PHOTO (background + subject only).
${recomposeNote}
- FULL-BLEED photorealistic image — edge to edge, no letterboxing, no black bars, no blur padding.
- Keep the SAME person, SAME face identity, SAME uniform/clothing, SAME story mood and color palette.
- ${input.layoutHint}
- Dramatic lighting, sharp focus on the face, high CTR viral aesthetic.
- Make it look like a newly shot professional thumbnail — not a resized copy of the reference.`;
}

export function buildAdjustAiPrompt(input: {
  adminPrompt: string;
  ratio: string;
  textLayout: AdjustTextLayout;
}): string {
  const ratioLabel = resolveThumbnailRatioLabel(input.ratio);
  const { blocks, layoutHint, condensed } = input.textLayout;

  const textSection =
    blocks.length > 0
      ? `TEXT OVERLAY (same story & language${condensed ? ', condensed into readable blocks' : ''} — do NOT paste as one giant paragraph):
${blocks.map((block, i) => `Block ${i + 1}: "${block}"`).join('\n')}

Typography: ultra-bold sans-serif, ALL CAPS or Title Case, stroke/outline for readability, 2–3 colors max (e.g. yellow + white).
${thumbnailTextSafeZoneRule(input.ratio)}`
      : `Reproduce all visible text from the reference exactly, split into max 3 readable blocks.
${thumbnailTextSafeZoneRule(input.ratio)}`;

  return `${input.adminPrompt.trim()}

TASK: Create a premium viral ${ratioLabel} YouTube thumbnail. FULL-BLEED — edge to edge, no letterboxing, no black bars, no blur padding.

REFERENCE: Use the attached image for SAME people, SAME faces, SAME story mood, SAME color palette.

${layoutHint}

${textSection}

Quality rules:
- Professional CTR thumbnail, photorealistic subject, sharp focus on face.
- Text must be readable on mobile — never tiny, never one unreadable wall of text.
- Never place text over faces.
- Dramatic lighting, saturated colors, clean composition.
- ${thumbnailTextSafeZoneRule(input.ratio)}`;
}

export function buildGenerateAiPrompt(combinedPrompt: string, ratio: string): string {
  const ratioLabel = resolveThumbnailRatioLabel(ratio);
  return `${combinedPrompt.trim()}

Target aspect ratio: ${ratioLabel}. Full-bleed edge-to-edge. Professional YouTube thumbnail, bold readable text (max 3 blocks), high CTR.
${thumbnailTextSafeZoneRule(ratio)}`;
}

export type CondensedAdjustText = {
  blocks: string[];
  colorNotes?: string;
};

/** Prompt for OpenAI to condense long OCR into thumbnail text blocks. */
export const ADJUST_TEXT_CONDENSE_PROMPT = `You restructure long thumbnail overlay text into 2-3 short, high-CTR blocks for programmatic text overlay.

Rules:
- Fix OCR errors: remove garbled characters, pipe symbols, stray punctuation, and wrong-script letters.
- Use exactly ONE language — never mix Bengali and English in the same block or output.
- If the readable source text is English, output English only (ALL CAPS ok). If Bengali, output Bengali only.
- Keep the SAME story facts — do not invent new details.
- Each block max ~12 words / ~80 characters when possible.
- Block 1 = hook, Block 2 = tension, Block 3 = cliffhanger (if needed).
- Keep each block short enough to fit with 10px margins on left and right at 1080px width.
- Return JSON only: { "blocks": ["...", "..."], "colorNotes": "e.g. alternate yellow and white" }`;
