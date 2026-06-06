'use client';

import { usePathname } from 'next/navigation';
import { activeCustomAds, hasProAccess } from '@hellodownloader/shared-types';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useUserStore } from '@/store/userStore';
import { useClientMounted } from '@/hooks/useClientMounted';
import { resolveAdPageFromPath } from '@/lib/ad-page-path';
import { PageAdsBottom } from '@/components/ads/PageAdsZones';

/** Bottom ad zone on every public page. */
export function SiteRouteAdsBottom() {
  const mounted = useClientMounted();
  const pathname = usePathname() ?? '/';
  const page = resolveAdPageFromPath(pathname);
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !page || !loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) {
    return null;
  }

  const hasCustomBottom = activeCustomAds(config.customAds, { page, position: 'bottom' }).length > 0;
  if (!hasCustomBottom) return null;

  return (
    <div className="border-t border-border/60 bg-background/40">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <PageAdsBottom page={page} />
      </div>
    </div>
  );
}
