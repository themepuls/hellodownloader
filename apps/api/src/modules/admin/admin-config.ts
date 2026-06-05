export type AdsRuntimeConfig = {
  bannerEnabled: boolean;
  popupEnabled: boolean;
  rewardedEnabled: boolean;
  creditsReward: number;
};

const defaults: AdsRuntimeConfig = {
  bannerEnabled: true,
  popupEnabled: true,
  rewardedEnabled: true,
  creditsReward: 1,
};

let adsOverrides: Partial<AdsRuntimeConfig> = {};
let retentionHoursOverride: number | null = null;

export const adminRuntimeConfig = {
  getAds(): AdsRuntimeConfig {
    return { ...defaults, ...adsOverrides };
  },
  setAds(patch: Partial<AdsRuntimeConfig>) {
    adsOverrides = { ...adsOverrides, ...patch };
  },
  getRetentionHours(fallback: number) {
    return retentionHoursOverride ?? fallback;
  },
  setRetentionHours(hours: number) {
    retentionHoursOverride = hours;
  },
};
