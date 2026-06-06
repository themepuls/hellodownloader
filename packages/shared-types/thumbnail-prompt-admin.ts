export const THUMBNAIL_PROMPT_TYPES = ['global', 'category', 'adjust'] as const;
export type ThumbnailPromptType = (typeof THUMBNAIL_PROMPT_TYPES)[number];

export const THUMBNAIL_PROMPT_STATUSES = ['enabled', 'disabled'] as const;
export type ThumbnailPromptStatus = (typeof THUMBNAIL_PROMPT_STATUSES)[number];

export type ThumbnailPromptRecord = {
  id: string;
  name: string;
  slug: string;
  type: ThumbnailPromptType;
  content: string;
  status: ThumbnailPromptStatus;
  createdAt: string;
  updatedAt: string;
};

export type ThumbnailPromptPreviewInput = {
  categorySlug?: string;
  mode?: 'generate' | 'adjust';
  strategyPrompt?: string;
  userInstructions?: string;
};

export type ThumbnailPromptPreviewResult = {
  preview: string;
  parts: {
    global?: string;
    category?: string;
    adjust?: string;
    strategy?: string;
    instructions?: string;
  };
};

export const DEFAULT_GLOBAL_THUMBNAIL_PROMPT = `Apply these universal rules to every thumbnail generation:
- Never place text over faces.
- Keep overlay text at least 10px inset from left, right, top, and bottom frame edges.
- Optimize for mobile readability and high CTR.
- Create strong curiosity and emotional hooks.
- Maintain clear visual hierarchy with bold, readable text.
- Keep important subjects fully visible and unobstructed.
- Avoid clutter; use a maximum of three text blocks unless the category allows more.`;

export const DEFAULT_ADJUST_THUMBNAIL_PROMPT = `When adjusting an existing thumbnail with AI:
- Preserve the same story, faces, and text meaning from the reference.
- Recompose for the target ratio with professional viral YouTube layout (not a text wall).
- Use max 3 bold text blocks with high contrast typography.
- Place the subject in the lower frame; text in the upper safe zone.
- Full-bleed composition — no letterboxing or empty margins.
- Match original color style (e.g. yellow + white alternating text).
- All text must have at least 10px padding from left, right, top, and bottom edges — never clip letters.`;

export const DEFAULT_CATEGORY_THUMBNAIL_PROMPTS: Array<{
  name: string;
  slug: string;
  content: string;
}> = [
  {
    name: 'Emotional Story',
    slug: 'emotional-story',
    content:
      'Category: Emotional Story. Use storytelling hooks, emotional faces, and journey-driven text. Prioritize empathy and curiosity.',
  },
  {
    name: 'Funny',
    slug: 'funny',
    content:
      'Category: Funny. Use exaggerated expressions, humor-driven headlines, and playful contrast. Keep text short and punchy.',
  },
  {
    name: 'Marketing',
    slug: 'marketing',
    content:
      'Category: Marketing. Focus on authority, benefits, and clear value propositions. Use professional layout and trust cues.',
  },
  {
    name: 'Product',
    slug: 'product',
    content:
      'Category: Product. Highlight the product clearly, show benefits, and use clean composition with minimal distracting text.',
  },
  {
    name: 'News',
    slug: 'news',
    content:
      'Category: News. Use breaking-news urgency, bold headlines, and high-contrast text. Convey timeliness and importance.',
  },
  {
    name: 'Crime',
    slug: 'crime',
    content:
      'Category: Crime. Use mystery, tension, and curiosity-driven hooks. Dark mood with readable high-contrast text.',
  },
  {
    name: 'Motivation',
    slug: 'motivation',
    content:
      'Category: Motivation. Use inspirational tone, strong verbs, and uplifting visuals. Text should feel empowering.',
  },
  {
    name: 'Finance',
    slug: 'finance',
    content:
      'Category: Finance. Emphasize wealth, results, and credibility. Use numbers and outcome-focused headlines when relevant.',
  },
  {
    name: 'Podcast',
    slug: 'podcast',
    content:
      'Category: Podcast. Feature hosts or guests prominently with episode hook text. Conversational but click-worthy.',
  },
  {
    name: 'Gaming',
    slug: 'gaming',
    content:
      'Category: Gaming. Maximize action, excitement, and energy. Use dynamic composition and bold game-related hooks.',
  },
  {
    name: 'Education',
    slug: 'education',
    content:
      'Category: Education. Clarify the learning outcome, use clean layout, and make the topic instantly understandable.',
  },
  {
    name: 'Technology',
    slug: 'technology',
    content:
      'Category: Technology. Highlight innovation, gadgets, or software with sleek modern aesthetics and clear hooks.',
  },
  {
    name: 'Health',
    slug: 'health',
    content:
      'Category: Health. Use trustworthy, clear messaging about outcomes or tips. Avoid sensationalism; prioritize clarity.',
  },
  {
    name: 'Travel',
    slug: 'travel',
    content:
      'Category: Travel. Showcase destination beauty with wanderlust-driven text. Use vivid imagery and aspirational hooks.',
  },
  {
    name: 'Faith',
    slug: 'faith',
    content:
      'Category: Faith. Use respectful, uplifting tone with meaningful hooks. Keep text sincere and readable.',
  },
  {
    name: 'Movie Explained',
    slug: 'movie-explained',
    content:
      'Category: Movie Explained. Use 1–2 text blocks, strong curiosity, and show the main character. Explain-the-plot energy.',
  },
  {
    name: 'Movie Poster',
    slug: 'movie-poster',
    content:
      'Category: Movie Poster. Minimal text, cinematic look, focus on characters and dramatic composition.',
  },
];

export function slugifyThumbnailPromptName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function composeThumbnailPromptPreview(input: {
  global?: string | null;
  category?: string | null;
  adjust?: string | null;
  strategy?: string | null;
  instructions?: string | null;
  mode?: 'generate' | 'adjust';
}): ThumbnailPromptPreviewResult {
  const parts: ThumbnailPromptPreviewResult['parts'] = {};
  const sections: string[] = [];

  if (input.global?.trim()) {
    parts.global = input.global.trim();
    sections.push(`=== GLOBAL PROMPT ===\n${parts.global}`);
  }

  if (input.category?.trim()) {
    parts.category = input.category.trim();
    sections.push(`=== CATEGORY PROMPT ===\n${parts.category}`);
  }

  if (input.mode === 'adjust' && input.adjust?.trim()) {
    parts.adjust = input.adjust.trim();
    sections.push(`=== AI ADJUST PROMPT ===\n${parts.adjust}`);
  }

  if (input.strategy?.trim()) {
    parts.strategy = input.strategy.trim();
    sections.push(`=== STRATEGY / GENERATION PROMPT ===\n${parts.strategy}`);
  }

  if (input.instructions?.trim()) {
    parts.instructions = input.instructions.trim();
    sections.push(`=== ADDITIONAL INSTRUCTIONS ===\n${parts.instructions}`);
  }

  return {
    preview: sections.join('\n\n'),
    parts,
  };
}
