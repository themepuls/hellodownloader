export const THUMBNAIL_CATEGORY_AUTO = 'auto' as const;

export const THUMBNAIL_CATEGORY_OPTIONS = [
  { value: THUMBNAIL_CATEGORY_AUTO, label: 'Auto Detect' },
  { value: 'emotional-story', label: 'Emotional Story' },
  { value: 'funny', label: 'Funny' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'product', label: 'Product' },
  { value: 'news', label: 'News' },
  { value: 'crime', label: 'Crime' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'finance', label: 'Finance' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'education', label: 'Education' },
  { value: 'technology', label: 'Technology' },
  { value: 'health', label: 'Health' },
  { value: 'travel', label: 'Travel' },
  { value: 'faith', label: 'Faith' },
  { value: 'movie-explained', label: 'Movie Explained' },
  { value: 'movie-poster', label: 'Movie Poster' },
] as const;

export type ThumbnailCategoryValue = (typeof THUMBNAIL_CATEGORY_OPTIONS)[number]['value'];

export function resolveThumbnailCategoryLabel(value: string): string | undefined {
  if (!value || value === THUMBNAIL_CATEGORY_AUTO) return undefined;
  const match = THUMBNAIL_CATEGORY_OPTIONS.find((o) => o.value === value);
  return match?.label ?? value;
}

export type ThumbnailPreview = {
  thumbnail: string;
  title: string;
  channel: string;
  width?: number;
  height?: number;
  resolution?: string;
  /** Explains when source max quality is reached (e.g. YouTube 1280×720 cap). */
  maxQualityNote?: string;
};

export function formatThumbnailResolution(width?: number, height?: number): string | undefined {
  if (width && height) return `${width}×${height}`;
  if (width) return `${width}×${Math.round(width * (9 / 16))}`;
  return undefined;
}
