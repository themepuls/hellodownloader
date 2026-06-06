import type { MetadataRoute } from 'next';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';
import {
  fetchSitemapPages,
  resolvePublicPath,
  resolveSiteBaseUrl,
} from '@/lib/sitemap';

const EXTRA_ROUTES: Array<{
  path: string;
  routeKey?: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '/playlist', routeKey: 'playlist', priority: 0.8, changeFrequency: 'weekly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await fetchSiteSettings();
  const baseUrl = resolveSiteBaseUrl(settings.siteUrl);
  const pages = await fetchSitemapPages();
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  for (const page of pages) {
    if (page.noIndex) continue;
    const path = resolvePublicPath(page.slug);
    if (!path) continue;

    const url = `${baseUrl}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    entries.push({
      url,
      lastModified: page.updatedAt,
      changeFrequency: page.slug === 'home' ? 'daily' : 'weekly',
      priority: page.slug === 'home' ? 1 : path.startsWith('/p/') ? 0.5 : 0.8,
    });
  }

  for (const route of EXTRA_ROUTES) {
    if (route.routeKey && settings.routeSeo?.[route.routeKey]?.noIndex) continue;
    const url = `${baseUrl}${route.path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    entries.push({
      url,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  return entries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
