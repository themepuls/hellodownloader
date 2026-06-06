import type { CustomAdItem } from './custom-ads';
import { activeCustomAds, normalizeCustomAds } from './custom-ads';

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
  };
}
