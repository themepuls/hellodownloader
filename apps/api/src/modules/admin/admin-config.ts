import type { HdQualityAccessConfig } from '@hellodownloader/shared-types';
import {
  DEFAULT_ADS_ADMIN_CONFIG,
  DEFAULT_HD_QUALITY_ACCESS,
  normalizeCustomAds,
  normalizeHdQualityAccess,
  type AdsAdminConfig,
} from '@hellodownloader/shared-types';

/** @deprecated use AdsAdminConfig toggles */
export type AdsRuntimeConfig = {
  bannerEnabled: boolean;
  popupEnabled: boolean;
  rewardedEnabled: boolean;
  creditsReward: number;
};

let adsAdminConfig: AdsAdminConfig = { ...DEFAULT_ADS_ADMIN_CONFIG };
let retentionHoursOverride: number | null = null;
let downloadQualityAccessOverride: Partial<HdQualityAccessConfig> | null = null;

function mergeAdsConfig(patch: Partial<AdsAdminConfig>): AdsAdminConfig {
  adsAdminConfig = {
    ...adsAdminConfig,
    ...patch,
    popupDelayMs: Math.max(0, patch.popupDelayMs ?? adsAdminConfig.popupDelayMs),
    creditsReward: Math.max(1, patch.creditsReward ?? adsAdminConfig.creditsReward),
    customAds: patch.customAds
      ? normalizeCustomAds(patch.customAds)
      : adsAdminConfig.customAds,
  };
  return adsAdminConfig;
}

export const adminRuntimeConfig = {
  getAdsAdminConfig(): AdsAdminConfig {
    const merged = { ...DEFAULT_ADS_ADMIN_CONFIG, ...adsAdminConfig };
    return {
      ...merged,
      customAds: normalizeCustomAds(merged.customAds),
      bannerSlotId: process.env.AD_BANNER_SLOT ?? merged.bannerSlotId,
      popupSlotId: process.env.AD_POPUP_SLOT ?? merged.popupSlotId,
      rewardedSlotId: process.env.AD_REWARDED_SLOT ?? merged.rewardedSlotId,
    };
  },
  setAdsAdminConfig(patch: Partial<AdsAdminConfig>) {
    return mergeAdsConfig(patch);
  },
  /** Legacy helper for settings page fragments */
  getAds(): AdsRuntimeConfig {
    const c = this.getAdsAdminConfig();
    return {
      bannerEnabled: c.bannerEnabled,
      popupEnabled: c.popupEnabled,
      rewardedEnabled: c.rewardedEnabled,
      creditsReward: c.creditsReward,
    };
  },
  setAds(patch: Partial<AdsRuntimeConfig>) {
    mergeAdsConfig(patch);
  },
  getRetentionHours(fallback: number) {
    return retentionHoursOverride ?? fallback;
  },
  setRetentionHours(hours: number) {
    retentionHoursOverride = hours;
  },
  getDownloadQualityAccess(): HdQualityAccessConfig {
    return normalizeHdQualityAccess({
      ...DEFAULT_HD_QUALITY_ACCESS,
      ...downloadQualityAccessOverride,
    });
  },
  setDownloadQualityAccess(patch: Partial<HdQualityAccessConfig>) {
    downloadQualityAccessOverride = {
      ...(downloadQualityAccessOverride ?? {}),
      ...patch,
    };
  },
};
