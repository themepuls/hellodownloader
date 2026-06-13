import type { Metadata } from 'next';
import {
  DEFAULT_PAGE_SEO,
  DEFAULT_SITE_SETTINGS,
  mergePageSeo,
  type PageSeoContent,
  type SiteSettingsPublic,
} from '@hellodownloader/shared-types';
import { fetchPageContent } from '@/lib/fetch-content';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';
import { resolveSiteBaseUrl } from '@/lib/sitemap';
import { normalizeStoredAssetUrl } from '@hellodownloader/shared-types';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  resolvePublicAssetUrl,
} from '@/lib/seo/public-asset-url';

type BuildMetadataInput = {
  contentSlug?: string;
  routeKey?: string;
  path?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
};

function resolveSiteUrl(settings: SiteSettingsPublic): URL | undefined {
  try {
    return new URL(`${resolveSiteBaseUrl(settings.siteUrl)}/`);
  } catch {
    return undefined;
  }
}

function buildIcons(settings: SiteSettingsPublic, siteUrl: string): Metadata['icons'] {
  const favicon = resolvePublicAssetUrl(settings.faviconUrl, siteUrl);
  if (favicon) {
    return { icon: favicon, shortcut: favicon, apple: favicon };
  }
  return { icon: '/favicon.svg', shortcut: '/favicon.svg' };
}

function applyTitleTemplate(template: string, title: string, siteName: string): string {
  if (!title) return siteName;
  if (template.includes('%s')) return template.replace('%s', title);
  return `${title} | ${siteName}`;
}

function pickSeo(
  pageSeo: PageSeoContent,
  settings: SiteSettingsPublic,
  routeKey?: string,
): PageSeoContent {
  const routePartial = routeKey ? settings.routeSeo?.[routeKey] : undefined;
  return mergePageSeo({ ...routePartial, ...pageSeo });
}

function buildFromSeo(
  seo: PageSeoContent,
  settings: SiteSettingsPublic,
  path?: string,
): Metadata {
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const title =
    seo.metaTitle ||
    settings.defaultMetaTitle ||
    DEFAULT_SITE_SETTINGS.defaultMetaTitle;
  const description =
    seo.metaDescription ||
    settings.defaultMetaDescription ||
    DEFAULT_SITE_SETTINGS.defaultMetaDescription;
  const keywords = seo.keywords || settings.defaultKeywords;
  const ogTitle = seo.ogTitle || title;
  const ogDescription = seo.ogDescription || description;
  const metadataBase = resolveSiteUrl(settings);
  const ogImageRaw = normalizeStoredAssetUrl(seo.ogImage || settings.defaultOgImage);
  const ogImage = resolvePublicAssetUrl(ogImageRaw, settings.siteUrl);
  const canonicalPath = seo.canonicalUrl.trim() || path || '';
  const canonical =
    canonicalPath && metadataBase
      ? new URL(canonicalPath.replace(/^\//, ''), metadataBase).toString()
      : canonicalPath || undefined;

  const verification: Metadata['verification'] = {};
  if (settings.googleSiteVerification.trim()) {
    verification.google = settings.googleSiteVerification.trim();
  }
  if (settings.bingSiteVerification.trim()) {
    verification.other = { 'msvalidate.01': settings.bingSiteVerification.trim() };
  }

  return {
    metadataBase,
    icons: buildIcons(settings, settings.siteUrl),
    title: applyTitleTemplate(settings.titleTemplate, title, siteName),
    description,
    keywords: keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    robots: seo.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName,
      type: 'website',
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: ogTitle,
              },
            ],
          }
        : {}),
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description: ogDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(verification.google || verification.other ? { verification } : {}),
  };
}

export async function buildPageMetadata(input: BuildMetadataInput): Promise<Metadata> {
  const settings = await fetchSiteSettings();
  let pageSeo = DEFAULT_PAGE_SEO;

  if (input.contentSlug) {
    const sections = await fetchPageContent<Record<string, unknown>>(input.contentSlug, {});
    pageSeo = mergePageSeo(sections.seo as Partial<PageSeoContent> | undefined);
  }

  if (!pageSeo.metaTitle && input.fallbackTitle) {
    pageSeo = { ...pageSeo, metaTitle: input.fallbackTitle };
  }
  if (!pageSeo.metaDescription && input.fallbackDescription) {
    pageSeo = { ...pageSeo, metaDescription: input.fallbackDescription };
  }

  const seo = pickSeo(pageSeo, settings, input.routeKey);
  return buildFromSeo(seo, settings, input.path);
}

export async function buildRootMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettings();
  const homeSections = await fetchPageContent<Record<string, unknown>>('home', {});
  const pageSeo = mergePageSeo(homeSections.seo as Partial<PageSeoContent> | undefined);
  const seo = pickSeo(
    {
      ...pageSeo,
      metaTitle: pageSeo.metaTitle || settings.defaultMetaTitle,
      metaDescription: pageSeo.metaDescription || settings.defaultMetaDescription,
    },
    settings,
  );
  return buildFromSeo(seo, settings, '/');
}
