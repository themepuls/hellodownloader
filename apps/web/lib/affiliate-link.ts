import {
  affiliateUrlForPage,
  hasProAccess,
  normalizeAffiliateUrl,
  type AffiliateLinkPage,
  type AdsPublicConfig,
} from '@hellodownloader/shared-types';

/** Open affiliate URL in a new tab without navigating the current page. */
export function openAffiliateLink(url: string) {
  const normalized = normalizeAffiliateUrl(url);
  if (!normalized) return;
  window.open(normalized, '_blank', 'noopener,noreferrer');
}

export function openAffiliateForPage(
  config: AdsPublicConfig,
  page: AffiliateLinkPage,
  plan?: string,
  role?: string,
) {
  if (!config.showAds || hasProAccess(plan, role)) return;
  const url = affiliateUrlForPage(config.affiliateLinks, page);
  if (url) openAffiliateLink(url);
}
