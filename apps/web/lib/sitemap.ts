import { PAGE_DEFAULTS } from '@hellodownloader/shared-types';

/** Public routes always included (even if API fetch fails during sitemap build). */
export const STATIC_SITEMAP_PATHS: Array<{ slug: string; path: string; priority: number }> = [
  { slug: 'home', path: '/', priority: 1 },
  { slug: 'download', path: '/download', priority: 0.9 },
  { slug: 'tools', path: '/thumbnail', priority: 0.85 },
  { slug: 'pricing', path: '/pricing', priority: 0.8 },
  { slug: 'faq', path: '/faq', priority: 0.7 },
  { slug: 'terms', path: '/terms', priority: 0.5 },
  { slug: 'privacy', path: '/privacy', priority: 0.5 },
  { slug: 'dmca', path: '/dmca', priority: 0.5 },
  { slug: 'playlist', path: '/playlist', priority: 0.8 },
];

function resolveServerApiUrl(): string {
  // Server-side sitemap must hit the local API — never the public URL (502/circular).
  const local = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
  if (local?.includes('127.0.0.1') || local?.includes('localhost')) {
    return `${local}/api/v1`;
  }
  return 'http://127.0.0.1:4001/api/v1';
}

export type SitemapPageEntry = {
  slug: string;
  updatedAt: string;
  noIndex: boolean;
};

export async function fetchSitemapPages(): Promise<SitemapPageEntry[]> {
  try {
    const res = await fetch(`${resolveServerApiUrl()}/content/pages`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return (await res.json()) as SitemapPageEntry[];
  } catch {
    return [];
  }
}

/** CMS slug → public URL path. */
export const CMS_SLUG_TO_PATH: Record<string, string> = {
  home: '/',
  pricing: '/pricing',
  download: '/download',
  tools: '/thumbnail',
  faq: '/faq',
  terms: '/terms',
  privacy: '/privacy',
  dmca: '/dmca',
};

/** Not real pages — exclude from sitemap. */
export const SITEMAP_EXCLUDED_SLUGS = new Set(['header', 'footer']);

export function resolvePublicPath(slug: string): string | null {
  if (SITEMAP_EXCLUDED_SLUGS.has(slug)) return null;
  if (CMS_SLUG_TO_PATH[slug]) return CMS_SLUG_TO_PATH[slug];
  if (slug in PAGE_DEFAULTS) return null;
  return `/p/${slug}`;
}

export function resolveSiteBaseUrl(siteUrl: string): string {
  const candidates = [
    siteUrl.trim(),
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.WEB_URL?.trim(),
    process.env.CORS_ORIGIN?.split(',')[0]?.trim(),
  ].filter((v): v is string => Boolean(v && v.startsWith('http')));

  const isLocal = (url: string) => /localhost|127\.0\.0\.1/i.test(url);

  if (process.env.NODE_ENV === 'production') {
    const live = candidates.find((c) => !isLocal(c));
    if (live) return live.replace(/\/$/, '');
  }

  const raw = candidates.find((c) => !isLocal(c)) ?? candidates[0] ?? 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
