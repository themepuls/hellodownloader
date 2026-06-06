import type { MetadataRoute } from 'next';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';
import { resolveSiteBaseUrl } from '@/lib/sitemap';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await fetchSiteSettings();
  const baseUrl = resolveSiteBaseUrl(settings.siteUrl);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/login', '/register', '/billing/', '/settings/', '/profile/', '/credits/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
