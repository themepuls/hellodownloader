import { normalizeStoredAssetUrl } from '@hellodownloader/shared-types';
import { resolveSiteBaseUrl } from '@/lib/sitemap';

export { normalizeStoredAssetUrl };

export function resolvePublicAssetUrl(assetPath: string, siteUrl = ''): string | undefined {
  const normalized = normalizeStoredAssetUrl(assetPath);
  if (!normalized) return undefined;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const base = resolveSiteBaseUrl(siteUrl);
  return `${base}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

/** Recommended Open Graph share image size for Facebook, X, LinkedIn. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
