export const HD_QUALITY_TIERS = [1080, 1440, 2160] as const;
export type HdQualityTier = (typeof HD_QUALITY_TIERS)[number];
export type QualityTierAccess = 'free' | 'pro';

export type HdQualityAccessConfig = Record<HdQualityTier, QualityTierAccess>;

export const HD_QUALITY_TIER_LABELS: Record<HdQualityTier, string> = {
  1080: '1080p (FHD)',
  1440: '1440p (QHD)',
  2160: '4K (2160p)',
};

export const DEFAULT_HD_QUALITY_ACCESS: HdQualityAccessConfig = {
  1080: 'pro',
  1440: 'pro',
  2160: 'pro',
};

export function normalizeHdQualityAccess(
  value: Partial<HdQualityAccessConfig> | null | undefined,
): HdQualityAccessConfig {
  return {
    1080: value?.[1080] === 'free' ? 'free' : 'pro',
    1440: value?.[1440] === 'free' ? 'free' : 'pro',
    2160: value?.[2160] === 'free' ? 'free' : 'pro',
  };
}

/** Map a format height to the HD tier bucket used for access control. */
export function qualityTierForHeight(height: number): HdQualityTier | null {
  if (height >= 2160) return 2160;
  if (height >= 1440) return 1440;
  if (height >= 1080) return 1080;
  return null;
}

export function isQualityAccessible(
  height: number,
  access: HdQualityAccessConfig,
  isPro: boolean,
): boolean {
  const tier = qualityTierForHeight(height);
  if (!tier) return true;
  if (access[tier] === 'free') return true;
  return isPro;
}

export function maxAccessibleQuality(access: HdQualityAccessConfig, isPro: boolean): number {
  let max = 720;
  for (const tier of HD_QUALITY_TIERS) {
    if (access[tier] === 'free' || isPro) {
      max = tier;
    }
  }
  return max;
}
