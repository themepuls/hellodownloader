'use client';

import { hasProAccess, type AdsPublicConfig } from '@hellodownloader/shared-types';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useUserStore } from '@/store/userStore';
import { AdCodeSlot } from './AdCodeSlot';

type AdBannerSlotProps = {
  placement?: string;
  className?: string;
};

export function AdBannerSlot({ placement = 'banner', className }: AdBannerSlotProps) {
  const mounted = useClientMounted();
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !loaded || !shouldShowBanner(config, user?.plan, user?.role)) return null;

  const banner = config.banner!;

  return (
    <AdCodeSlot
      slotId={banner.slotId}
      placement={placement}
      adTag={banner.adTag}
      html={banner.html}
      css={banner.css}
      js={banner.js}
      className={className}
    />
  );
}

function shouldShowBanner(
  config: AdsPublicConfig,
  plan?: string | null,
  role?: string | null,
) {
  return config.showAds && config.banner?.enabled && !hasProAccess(plan, role);
}
