export type VideoPlatform =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'vimeo'
  | 'unknown';

export interface SupportedPlatform {
  id: VideoPlatform;
  label: string;
  patterns: RegExp[];
}

export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    patterns: [/youtube\.com/i, /youtu\.be/i],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    patterns: [/facebook\.com/i, /fb\.watch/i, /fb\.com/i, /m\.facebook\.com/i],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    patterns: [/instagram\.com/i, /instagr\.am/i],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    patterns: [/tiktok\.com/i, /vm\.tiktok\.com/i, /vt\.tiktok\.com/i],
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    patterns: [/twitter\.com/i, /x\.com/i],
  },
  {
    id: 'vimeo',
    label: 'Vimeo',
    patterns: [/vimeo\.com/i],
  },
];

export const SUPPORTED_PLATFORM_LABELS = SUPPORTED_PLATFORMS.map((p) => p.label).join(', ');

export const SUPPORTED_PLATFORMS_SHORT =
  'YouTube, Facebook, Instagram, TikTok, Twitter/X, and more';

export function detectPlatform(url: string): VideoPlatform {
  for (const platform of SUPPORTED_PLATFORMS) {
    if (platform.patterns.some((pattern) => pattern.test(url))) {
      return platform.id;
    }
  }
  return 'unknown';
}

export function isSocialPlatform(platform: VideoPlatform): boolean {
  return platform === 'facebook' || platform === 'instagram' || platform === 'tiktok' || platform === 'twitter';
}

export function isReelUrl(url: string, platform: VideoPlatform): boolean {
  if (platform === 'instagram') return /\/reel\//i.test(url);
  if (platform === 'facebook') return /\/reels?\//i.test(url);
  return false;
}
