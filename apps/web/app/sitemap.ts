import type { MetadataRoute } from 'next';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';
import {
  fetchSitemapPages,
  resolvePublicPath,
  resolveSiteBaseUrl,
  STATIC_SITEMAP_PATHS,
} from '@/lib/sitemap';

/** Always rebuild — avoid serving stale localhost URLs after deploy. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await fetchSiteSettings();
  const baseUrl = resolveSiteBaseUrl(settings.siteUrl);
  const pages = await fetchSitemapPages();
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  const apiBySlug = new Map(pages.map((p) => [p.slug, p]));

  for (const route of STATIC_SITEMAP_PATHS) {
    if (route.slug === 'playlist' && settings.routeSeo?.playlist?.noIndex) continue;
    const api = apiBySlug.get(route.slug);
    if (api?.noIndex) continue;

    const url = `${baseUrl}${route.path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    entries.push({
      url,
      lastModified: api?.updatedAt ? new Date(api.updatedAt) : new Date(),
      changeFrequency: route.slug === 'home' ? 'daily' : 'weekly',
      priority: route.priority,
    });
  }

  for (const page of pages) {
    if (page.noIndex) continue;
    const path = resolvePublicPath(page.slug);
    if (!path) continue;

    const url = `${baseUrl}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    entries.push({
      url,
      lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
      changeFrequency: page.slug === 'home' ? 'daily' : 'weekly',
      priority: page.slug === 'home' ? 1 : path.startsWith('/p/') ? 0.5 : 0.8,
    });
  }

  return entries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
