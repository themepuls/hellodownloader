import { PAGE_DEFAULTS } from '@hellodownloader/shared-types';

function resolveServerApiUrl(): string {
  const publicBase = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
  if (publicBase) return `${publicBase}/api/v1`;
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured?.startsWith('http')) return configured.replace(/\/$/, '');
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

  const raw = candidates[0] ?? 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
