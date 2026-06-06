export type ThumbnailStrategyResult = {
  detectedCategory: string;
  detectedTextStyle: string;
  emotion: string;
  headline: string;
  subheadline: string;
  textBlocks: string[];
  layout: string;
  textPosition: string;
  recommendedColors: string[];
  thumbnailScore: number;
  ctrScore: number;
  generationPrompt: string;
};

/** @deprecated use ThumbnailStrategyResult */
export type ThumbnailHeadlineResult = ThumbnailStrategyResult;

export type ThumbnailStrategyInput = {
  title: string;
  category?: string;
  textStyle?: string;
  ratio?: string;
  instructions?: string;
  imageAnalysis?: string;
};

export const THUMBNAIL_STRATEGY_PROMPT = `You are a world-class YouTube thumbnail strategist and viral CTR expert.

Your job is to analyze the title and thumbnail image and create the best thumbnail strategy possible.

TITLE:
{{TITLE}}

CATEGORY:
{{CATEGORY}}

TEXT_STYLE:
{{TEXT_STYLE}}

RATIO:
{{RATIO}}

ADDITIONAL_INSTRUCTIONS:
{{INSTRUCTIONS}}

IMAGE_ANALYSIS:
{{IMAGE_ANALYSIS}}

==================================================

FIRST DETERMINE:

1. Main topic
2. Main emotion
3. Main subject
4. Curiosity trigger
5. Best thumbnail type

==================================================

THUMBNAIL TYPES

Movie Poster
- Minimal text
- Focus on characters
- Cinematic look

Movie Explained
- 1-2 text blocks
- Strong curiosity
- Main character visible

Story Hook
- Short hook
- Maximum CTR
- 2 text blocks

Long Story
- Storytelling style
- Multiple text blocks
- Emotional journey

News
- Breaking news style
- High urgency

Marketing
- Business focused
- Authority driven

Product
- Product focused
- Benefit driven

Gaming
- Action focused
- Excitement driven

==================================================

GLOBAL RULES

- Never place text over faces.
- Keep important subjects visible.
- Optimize for mobile devices.
- Maintain readability.
- Create strong visual hierarchy.
- Create curiosity.
- Use emotional triggers.
- Avoid clutter.
- Use maximum 3 text blocks unless TEXT_STYLE = Long Story.
- Make viewers want to click.

==================================================

TEXT STYLE RULES

Short Hook

Example:

DOCTORS GAVE UP HOPE...

THEN THIS HAPPENED!

Medium Hook

Example:

THEY THOUGHT SHE WAS DEAD

THE BABY CHANGED EVERYTHING

Long Story

Example:

MY SON-IN-LAW WAS RUSHED INTO SURGERY...

THEN THE DOCTOR HANDED ME AN ENVELOPE...

Movie Poster

Example:

WARRIOR KING

Movie Explained

Example:

মৃতরা
তাকে দেখতে পায়

==================================================

LAYOUT RULES

Analyze image and determine:

- Best text location
- Safe text areas
- Subject position
- Empty areas
- Face locations

Possible layouts:

- Top Left
- Top Right
- Bottom Left
- Bottom Right
- Center
- Split Layout

==================================================

COLOR RULES

Emotional:
Yellow, White, Red

Crime:
Red, Black, White

Finance:
Green, White, Gold

Gaming:
Red, Orange, Purple

Movie:
Gold, White

News:
Red, White

==================================================

OUTPUT JSON ONLY

{
  "detectedCategory": "",
  "detectedTextStyle": "",
  "emotion": "",
  "headline": "",
  "subheadline": "",
  "textBlocks": [],
  "layout": "",
  "textPosition": "",
  "recommendedColors": [],
  "thumbnailScore": 0,
  "ctrScore": 0,
  "generationPrompt": ""
}`;

export const THUMBNAIL_TEXT_STYLE_AUTO = 'auto' as const;

export const THUMBNAIL_TEXT_STYLE_OPTIONS = [
  { value: THUMBNAIL_TEXT_STYLE_AUTO, label: 'Auto Detect' },
  { value: 'short-hook', label: 'Short Hook' },
  { value: 'medium-hook', label: 'Medium Hook' },
  { value: 'long-story', label: 'Long Story' },
  { value: 'movie-poster', label: 'Movie Poster' },
  { value: 'movie-explained', label: 'Movie Explained' },
] as const;

export type ThumbnailTextStyleValue = (typeof THUMBNAIL_TEXT_STYLE_OPTIONS)[number]['value'];

export const THUMBNAIL_RATIO_LABELS: Record<string, string> = {
  YOUTUBE_16_9: 'YouTube 16:9',
  SHORTS_9_16: 'Shorts 9:16',
  INSTAGRAM_4_5: 'Instagram 4:5',
  FACEBOOK_1_1: 'Facebook 1:1',
};

export function resolveThumbnailTextStyleLabel(value?: string): string {
  if (!value || value === THUMBNAIL_TEXT_STYLE_AUTO) return 'Auto Detect';
  const match = THUMBNAIL_TEXT_STYLE_OPTIONS.find((o) => o.value === value);
  return match?.label ?? value;
}

export function resolveThumbnailRatioLabel(ratio?: string): string {
  if (!ratio) return 'YouTube 16:9';
  return THUMBNAIL_RATIO_LABELS[ratio] ?? ratio;
}

export function buildThumbnailStrategyPrompt(input: ThumbnailStrategyInput): string {
  const hasImage = Boolean(input.imageAnalysis?.includes('attached'));
  return THUMBNAIL_STRATEGY_PROMPT.replace('{{TITLE}}', input.title.trim())
    .replace('{{CATEGORY}}', input.category?.trim() || 'Auto Detect')
    .replace('{{TEXT_STYLE}}', resolveThumbnailTextStyleLabel(input.textStyle))
    .replace('{{RATIO}}', resolveThumbnailRatioLabel(input.ratio))
    .replace('{{INSTRUCTIONS}}', input.instructions?.trim() || 'None')
    .replace(
      '{{IMAGE_ANALYSIS}}',
      input.imageAnalysis ??
        (hasImage
          ? 'Analyze the attached thumbnail image for faces, subjects, empty areas, and safe text zones.'
          : 'No thumbnail image provided. Recommend layout based on title and category only.'),
    );
}

/** @deprecated use buildThumbnailStrategyPrompt */
export function buildThumbnailHeadlinePrompt(title: string, category: string): string {
  return buildThumbnailStrategyPrompt({ title, category });
}

export function strategyToImagePrompt(result: ThumbnailStrategyResult): string {
  if (result.generationPrompt?.trim()) {
    return result.generationPrompt.trim();
  }

  const parts = [
    result.headline && `Primary headline text: "${result.headline}"`,
    result.subheadline && `Secondary headline text: "${result.subheadline}"`,
    result.textBlocks.length > 0 &&
      `Text blocks: ${result.textBlocks.map((t) => `"${t}"`).join(', ')}`,
    result.layout && `Layout: ${result.layout}`,
    result.textPosition && `Text placement: ${result.textPosition}`,
    result.recommendedColors.length > 0 &&
      `Text colors: ${result.recommendedColors.join(', ')}`,
    result.emotion && `Emotional tone: ${result.emotion}`,
  ].filter(Boolean);

  return parts.join('. ');
}

/** @deprecated use strategyToImagePrompt */
export function headlineToImagePrompt(result: ThumbnailStrategyResult): string {
  return strategyToImagePrompt(result);
}

export function buildThumbnailGeneratePrompt(
  strategy: ThumbnailStrategyResult | null,
  additionalInstructions: string,
): string {
  const parts: string[] = [];
  if (strategy) parts.push(strategyToImagePrompt(strategy));
  const extra = additionalInstructions.trim();
  if (extra) parts.push(extra);
  return parts.join('. ');
}

function normalizeStrategyTextBlock(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object') {
    const o = entry as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim();
    if (typeof o.content === 'string') return o.content.trim();
  }
  const s = String(entry ?? '').trim();
  return s === '[object Object]' ? '' : s;
}

export function normalizeThumbnailStrategyResult(
  raw: Partial<ThumbnailStrategyResult>,
  fallback?: { category?: string; textStyle?: string },
): ThumbnailStrategyResult {
  const textBlocks = Array.isArray(raw.textBlocks)
    ? raw.textBlocks
        .map((t) => normalizeStrategyTextBlock(t))
        .filter((t) => Boolean(t) && t !== '[object Object]')
    : [];

  const recommendedColors = Array.isArray(raw.recommendedColors)
    ? raw.recommendedColors.map((c) => String(c).trim()).filter(Boolean)
    : [];

  return {
    detectedCategory: String(raw.detectedCategory ?? fallback?.category ?? 'General').trim(),
    detectedTextStyle: String(raw.detectedTextStyle ?? fallback?.textStyle ?? 'Auto Detect').trim(),
    emotion: String(raw.emotion ?? '').trim(),
    headline: String(raw.headline ?? '').trim(),
    subheadline: String(raw.subheadline ?? '').trim(),
    textBlocks,
    layout: String(raw.layout ?? '').trim(),
    textPosition: String(raw.textPosition ?? '').trim(),
    recommendedColors,
    thumbnailScore: Number(raw.thumbnailScore) || 0,
    ctrScore: Number(raw.ctrScore) || 0,
    generationPrompt: String(raw.generationPrompt ?? '').trim(),
  };
}

export function formatStrategyCopyText(result: ThumbnailStrategyResult): string {
  if (result.textBlocks.length > 0) {
    return result.textBlocks.join('\n');
  }
  return [result.headline, result.subheadline].filter(Boolean).join('\n');
}
