import type { CustomAdItem } from './custom-ads';
import { activeCustomAds, normalizeCustomAds, normalizeCustomAdsBannerHeightPx } from './custom-ads';

export type AffiliateLinksConfig = {
  enabled: boolean;
  download: string;
  audio: string;
  subtitle: string;
  thumbnail: string;
  playlist: string;
};

export const DEFAULT_AFFILIATE_LINKS: AffiliateLinksConfig = {
  enabled: false,
  download: '',
  audio: '',
  subtitle: '',
  thumbnail: '',
  playlist: '',
};

export type AffiliateLinkPage = keyof Omit<AffiliateLinksConfig, 'enabled'>;

/** Ensure affiliate URLs work when admins omit the scheme (e.g. google.com → https://google.com). */
export function normalizeAffiliateUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export type AdSlotCode = {
  slotId: string;
  enabled: boolean;
  /** Full snippet pasted from any ad network (scripts, iframe, div, etc.). Takes priority over html/css/js. */
  adTag: string;
  html: string;
  css: string;
  js: string;
};

export type AdsPublicConfig = {
  showAds: boolean;
  banner: (AdSlotCode & { delayMs?: never }) | null;
  popup: (AdSlotCode & { delayMs: number }) | null;
  rewarded: (AdSlotCode & { creditsReward: number }) | null;
  global: {
    /** Full global snippet (loader scripts, verification tags, etc.). */
    adTag: string;
    headHtml: string;
    headJs: string;
    css: string;
  };
  customAds: CustomAdItem[];
  affiliateLinks: AffiliateLinksConfig | null;
  /** Top/bottom custom banner strip height in pixels. */
  customAdsBannerHeightPx: number;
};

export type AdsAdminConfig = {
  bannerEnabled: boolean;
  popupEnabled: boolean;
  rewardedEnabled: boolean;
  customAdsEnabled: boolean;
  popupDelayMs: number;
  creditsReward: number;
  bannerSlotId: string;
  popupSlotId: string;
  rewardedSlotId: string;
  bannerAdTag: string;
  bannerHtml: string;
  bannerCss: string;
  bannerJs: string;
  popupAdTag: string;
  popupHtml: string;
  popupCss: string;
  popupJs: string;
  rewardedAdTag: string;
  rewardedHtml: string;
  rewardedCss: string;
  rewardedJs: string;
  globalAdTag: string;
  globalHeadHtml: string;
  globalHeadJs: string;
  globalCss: string;
  customAds: CustomAdItem[];
  affiliateLinksEnabled: boolean;
  /** Top/bottom custom banner strip height in pixels (admin). */
  customAdsBannerHeightPx: number;
  affiliateLinkDownload: string;
  affiliateLinkAudio: string;
  affiliateLinkSubtitle: string;
  affiliateLinkThumbnail: string;
  affiliateLinkPlaylist: string;
};

export const DEFAULT_ADS_ADMIN_CONFIG: AdsAdminConfig = {
  bannerEnabled: true,
  popupEnabled: true,
  rewardedEnabled: true,
  customAdsEnabled: true,
  popupDelayMs: 30000,
  creditsReward: 1,
  bannerSlotId: 'banner-1',
  popupSlotId: 'popup-1',
  rewardedSlotId: 'rewarded-1',
  bannerAdTag: '',
  bannerHtml: '',
  bannerCss: '',
  bannerJs: '',
  popupAdTag: '',
  popupHtml: '',
  popupCss: '',
  popupJs: '',
  rewardedAdTag: '',
  rewardedHtml: '',
  rewardedCss: '',
  rewardedJs: '',
  globalAdTag: '',
  globalHeadHtml: '',
  globalHeadJs: '',
  globalCss: '',
  customAds: [],
  affiliateLinksEnabled: false,
  customAdsBannerHeightPx: 170,
  affiliateLinkDownload: '',
  affiliateLinkAudio: '',
  affiliateLinkSubtitle: '',
  affiliateLinkThumbnail: '',
  affiliateLinkPlaylist: '',
};

function slotFromAdmin(
  enabled: boolean,
  slotId: string,
  adTag: string,
  html: string,
  css: string,
  js: string,
): AdSlotCode | null {
  if (!enabled) return null;
  return { slotId, enabled: true, adTag, html, css, js };
}

function affiliateLinksFromAdmin(admin: AdsAdminConfig, showAds: boolean): AffiliateLinksConfig | null {
  if (!showAds || !admin.affiliateLinksEnabled) return null;
  return {
    enabled: true,
    download: normalizeAffiliateUrl(admin.affiliateLinkDownload),
    audio: normalizeAffiliateUrl(admin.affiliateLinkAudio),
    subtitle: normalizeAffiliateUrl(admin.affiliateLinkSubtitle),
    thumbnail: normalizeAffiliateUrl(admin.affiliateLinkThumbnail),
    playlist: normalizeAffiliateUrl(admin.affiliateLinkPlaylist),
  };
}

export function affiliatePageForDownloadType(type?: string | null): AffiliateLinkPage {
  switch (type) {
    case 'MP3':
      return 'audio';
    case 'SUBTITLE':
      return 'subtitle';
    default:
      return 'download';
  }
}

export function affiliateUrlForPage(
  links: AffiliateLinksConfig | null | undefined,
  page: AffiliateLinkPage,
): string | null {
  if (!links?.enabled) return null;
  const url = normalizeAffiliateUrl(links[page] ?? '');
  return url || null;
}

export function adsAdminToPublic(admin: AdsAdminConfig, showAds: boolean): AdsPublicConfig {
  return {
    showAds,
    banner:
      showAds
        ? slotFromAdmin(
            admin.bannerEnabled,
            admin.bannerSlotId,
            admin.bannerAdTag,
            admin.bannerHtml,
            admin.bannerCss,
            admin.bannerJs,
          )
        : null,
    popup:
      showAds && admin.popupEnabled
        ? {
            ...slotFromAdmin(
              true,
              admin.popupSlotId,
              admin.popupAdTag,
              admin.popupHtml,
              admin.popupCss,
              admin.popupJs,
            )!,
            delayMs: admin.popupDelayMs,
          }
        : null,
    rewarded:
      showAds && admin.rewardedEnabled
        ? {
            ...slotFromAdmin(
              true,
              admin.rewardedSlotId,
              admin.rewardedAdTag,
              admin.rewardedHtml,
              admin.rewardedCss,
              admin.rewardedJs,
            )!,
            creditsReward: admin.creditsReward,
          }
        : null,
    global: {
      adTag: admin.globalAdTag,
      headHtml: admin.globalHeadHtml,
      headJs: admin.globalHeadJs,
      css: admin.globalCss,
    },
    customAds:
      showAds && admin.customAdsEnabled
        ? activeCustomAds(normalizeCustomAds(admin.customAds))
        : [],
    customAdsBannerHeightPx: normalizeCustomAdsBannerHeightPx(admin.customAdsBannerHeightPx),
    affiliateLinks: affiliateLinksFromAdmin(admin, showAds),
  };
}
