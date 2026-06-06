import { resolveThumbnailRatioLabel } from './thumbnail-prompts';
import { thumbnailTextSafeZoneRule } from './thumbnail-image';

export type AdjustVisionTextBlock = {
  text: string;
  color: string;
  role?: string;
};

export type AdjustVisionSubject = {
  description: string;
  position: string;
};

export type AdjustVisionPlan = {
  language: string;
  subjects: AdjustVisionSubject[];
  textBlocks: AdjustVisionTextBlock[];
  styleNotes: string;
  layoutPlan: string;
  backgroundNotes?: string;
};

export const ADJUST_VISION_SYSTEM_PROMPT = `You are an expert YouTube thumbnail designer. Analyze the attached thumbnail image like a human designer would.

Return JSON only with this shape:
{
  "language": "english | bengali | other",
  "subjects": [{ "description": "who they are, clothing, expression", "position": "where in frame e.g. right third, center" }],
  "textBlocks": [{ "text": "exact wording from image", "color": "hex or name e.g. #FFD700 yellow", "role": "hook | body | banner | cta" }],
  "styleNotes": "typography, contrast, viral story style",
  "layoutPlan": "how to recompose for the TARGET ratio",
  "backgroundNotes": "scene, mood, blur, expansion ideas"
}

Rules:
- Read ALL visible text from the image — copy wording EXACTLY as shown. Do not paraphrase or shorten.
- Fix only obvious OCR typos (e.g. "the" → "they") when grammar is clearly wrong.
- Note each text block's color (green #00FF00, yellow #FFD700, white, red banner, etc.).
- Identify every person: gender, age, uniform/clothing, expression, face position.
- layoutPlan MUST follow the TARGET RATIO layout rules (vertical stack for Shorts, NOT side-by-side split).
- Max 5 textBlocks — separate banner/CTA (e.g. red bar) as its own block with role "banner".
- One language only — never mix scripts.
- Text must fit with padding from ALL edges — never clip letters.`;

function layoutRulesForRatio(ratio: string): string {
  switch (ratio) {
    case 'SHORTS_9_16':
      return `SHORTS 9:16 LAYOUT (mandatory — do NOT use 16:9 side-by-side split):
- TOP 52%: stack text blocks vertically, left-aligned, 24px+ padding from left AND right edges.
- BOTTOM 42%: subject face centered, fully visible, never covered by text.
- Expand background cinematically behind text (blurred office/courtroom OK).
- Red/yellow CTA banner (if any) spans full width at bottom of text zone.
- WRONG: text on left half + face on right half (that is horizontal layout — forbidden for Shorts).`;
    case 'INSTAGRAM_4_5':
      return `INSTAGRAM 4:5: text stacked upper 50%, subject lower 50%, generous side padding.`;
    case 'FACEBOOK_1_1':
      return `SQUARE 1:1: text left or top third, subject opposite side, balanced padding.`;
    default:
      return `YOUTUBE 16:9: text blocks on one side, subject on the other, strong hierarchy.`;
  }
}

export function buildAdjustVisionUserPrompt(input: {
  ratio: string;
  ocrHint?: string;
}): string {
  const ratioLabel = resolveThumbnailRatioLabel(input.ratio);
  let text = `TARGET OUTPUT: ${ratioLabel} viral YouTube thumbnail.

${layoutRulesForRatio(input.ratio)}

Analyze this original thumbnail and plan a full redesign:
1. Extract every text block — EXACT words + exact colors from the image.
2. Locate all people/faces (who, clothing, expression, current position).
3. Plan layout for ${ratioLabel} using the layout rules above.
4. Background: expand/recompose intelligently — no letterboxing.`;

  if (input.ocrHint?.trim()) {
    text += `\n\nOCR hint (cross-check wording — prefer image if OCR differs):\n${input.ocrHint.slice(0, 2500)}`;
  }

  return text;
}

/** Build one holistic image-generation prompt from vision analysis (ChatGPT-style). */
export function buildAdjustVisionImagePrompt(input: {
  adminPrompt: string;
  ratio: string;
  plan: AdjustVisionPlan;
}): string {
  const ratioLabel = resolveThumbnailRatioLabel(input.ratio);
  const { plan } = input;

  const textSection =
    plan.textBlocks.length > 0
      ? plan.textBlocks
          .map(
            (b, i) =>
              `Text block ${i + 1} (${b.color}${b.role ? `, ${b.role}` : ''}): "${b.text}"`,
          )
          .join('\n')
      : 'Reproduce all visible text from the reference in readable blocks.';

  const subjectSection =
    plan.subjects.length > 0
      ? plan.subjects
          .map((s) => `- ${s.description} (was ${s.position} — reposition for ${ratioLabel})`)
          .join('\n')
      : '- Keep the same person/face identity from the reference.';

  return `${input.adminPrompt.trim()}

TASK: Redesign this thumbnail for ${ratioLabel}. Full-bleed edge-to-edge — NO letterboxing, NO black bars.

LAYOUT (follow exactly — this is the #1 priority):
${layoutRulesForRatio(input.ratio)}
${plan.layoutPlan}

SUBJECTS — keep SAME person, SAME face identity, SAME uniform/clothing:
${subjectSection}

TEXT — render IN the image with bold viral typography, black stroke/outline, exact colors:
${textSection}
Copy text WORD-FOR-WORD from the blocks above. Fix grammar only if clearly wrong in source.

STYLE: ${plan.styleNotes}
${plan.backgroundNotes ? `BACKGROUND: ${plan.backgroundNotes}` : ''}

Quality checklist:
- ${thumbnailTextSafeZoneRule(input.ratio)}
- Mobile-readable: each block max 2-3 lines, scale font down before clipping.
- Never place text over faces.
- Match original colors exactly (green hooks, yellow highlights, white body, red banners).
- Photorealistic subject, dramatic lighting, high CTR.
- Must look like a native ${ratioLabel} Shorts thumbnail — NOT a cropped 16:9 side-by-side layout.`;
}

export function normalizeAdjustVisionPlan(raw: unknown): AdjustVisionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const textBlocks = Array.isArray(o.textBlocks)
    ? o.textBlocks
        .map((b) => {
          if (!b || typeof b !== 'object') return null;
          const block = b as Record<string, unknown>;
          const text = String(block.text ?? '').trim();
          if (!text) return null;
          return {
            text,
            color: String(block.color ?? '#FFFFFF').trim(),
            role: block.role ? String(block.role) : undefined,
          };
        })
        .filter(Boolean)
        .slice(0, 5) as AdjustVisionTextBlock[]
    : [];

  const subjects = Array.isArray(o.subjects)
    ? o.subjects
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const sub = s as Record<string, unknown>;
          const description = String(sub.description ?? '').trim();
          if (!description) return null;
          return {
            description,
            position: String(sub.position ?? 'center').trim(),
          };
        })
        .filter(Boolean) as AdjustVisionSubject[]
    : [];

  const layoutPlan = String(o.layoutPlan ?? '').trim();
  if (textBlocks.length === 0 && !layoutPlan) return null;

  return {
    language: String(o.language ?? 'english').trim(),
    subjects,
    textBlocks,
    styleNotes: String(o.styleNotes ?? 'Bold viral YouTube story thumbnail typography').trim(),
    layoutPlan:
      layoutPlan || layoutRulesForRatio('SHORTS_9_16').split('\n')[0]!,
    backgroundNotes: o.backgroundNotes ? String(o.backgroundNotes).trim() : undefined,
  };
}

export const ADJUST_TEXT_PROOFREAD_PROMPT = `You proofread thumbnail text blocks extracted from an image.

Return JSON: { "textBlocks": [{ "text": "...", "color": "...", "role": "..." }] }

Rules:
- Keep the SAME wording as the source — only fix clear grammar/typo errors (e.g. "until the read" → "until they read").
- Do not shorten, paraphrase, or merge blocks.
- Keep the same number of blocks, colors, and roles.
- Use OCR hint to verify spelling of names and key phrases.
- One language only.`;
