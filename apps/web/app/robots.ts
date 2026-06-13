import type { MetadataRoute } from 'next';
import { normalizeRobotsDisallow } from '@hellodownloader/shared-types';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';
import { resolveSiteBaseUrl } from '@/lib/sitemap';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await fetchSiteSettings();
  const baseUrl = resolveSiteBaseUrl(settings.siteUrl);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: normalizeRobotsDisallow(settings.robotsDisallow),
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
