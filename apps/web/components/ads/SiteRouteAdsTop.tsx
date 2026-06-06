'use client';

import { usePathname } from 'next/navigation';
import { activeCustomAds, hasProAccess } from '@hellodownloader/shared-types';
import { hasAdContent } from '@/lib/ad-tag-parser';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useUserStore } from '@/store/userStore';
import { useClientMounted } from '@/hooks/useClientMounted';
import { resolveAdPageFromPath } from '@/lib/ad-page-path';
import { PageAdsTop } from '@/components/ads/PageAdsZones';

/** Top ad strip on every public page (network banner + page custom top ads + "all pages" ads). */
export function SiteRouteAdsTop() {
  const mounted = useClientMounted();
  const pathname = usePathname() ?? '/';
  const page = resolveAdPageFromPath(pathname);
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !page || !loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) {
    return null;
  }

  const hasCustomTop = activeCustomAds(config.customAds, { page, position: 'top' }).length > 0;
  const banner = config.banner;
  const hasBanner =
    Boolean(banner?.enabled) &&
    hasAdContent(banner?.adTag ?? '', banner?.html ?? '', banner?.css ?? '', banner?.js ?? '');

  if (!hasCustomTop && !hasBanner) return null;

  return (
    <div className="border-b border-border/60 bg-background/60">
      <div className="container mx-auto max-w-5xl px-4 py-3">
        <PageAdsTop page={page} />
      </div>
    </div>
  );
}
