'use client';

import {
  activeCustomAds,
  hasProAccess,
  type CustomAdItem,
  type CustomAdPage,
  type CustomAdPosition,
} from '@hellodownloader/shared-types';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils';

type CustomAdsSlotProps = {
  page: CustomAdPage;
  position: CustomAdPosition;
  className?: string;
};

export function CustomAdsSlot({ page, position, className }: CustomAdsSlotProps) {
  const mounted = useClientMounted();
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) {
    return null;
  }

  const items = activeCustomAds(config.customAds, { page, position });
  if (!items.length) return null;

  const bannerHeightPx = config.customAdsBannerHeightPx ?? 170;

  return (
    <div className={className ?? 'space-y-4'}>
      {items.map((ad) => (
        <CustomAdCard key={ad.id} ad={ad} position={position} bannerHeightPx={bannerHeightPx} />
      ))}
    </div>
  );
}

function CustomAdCard({
  ad,
  position,
  bannerHeightPx,
}: {
  ad: CustomAdItem;
  position: CustomAdPosition;
  bannerHeightPx: number;
}) {
  const isTopBottom = position === 'top' || position === 'bottom';
  const isSidebar = position === 'sidebar';

  const frameClass = cn(
    'relative w-full overflow-hidden rounded-xl border border-border/50 bg-muted/25 shadow-sm',
    isSidebar &&
      ad.format === 'square' &&
      'aspect-square w-full max-w-[300px] mx-auto',
    isSidebar &&
      ad.format === 'banner' &&
      'aspect-[300/250] w-full max-w-[300px] mx-auto',
  );

  const frameStyle = isTopBottom ? { height: `${bannerHeightPx}px` } : undefined;

  const image = isTopBottom ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ad.imageUrl}
      alt={ad.title.trim() || 'Advertisement'}
      className="block h-full w-full"
      loading={position === 'top' ? 'eager' : 'lazy'}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ad.imageUrl}
      alt={ad.title.trim() || 'Advertisement'}
      className="block h-full w-full"
      loading="lazy"
    />
  );

  const content = ad.linkUrl.trim() ? (
    <a
      href={ad.linkUrl.trim()}
      target={ad.openInNewTab ? '_blank' : '_self'}
      rel={ad.openInNewTab ? 'noopener noreferrer sponsored' : undefined}
      className="block h-full w-full"
      aria-label={ad.title.trim() || 'Sponsored link'}
    >
      {image}
    </a>
  ) : (
    image
  );

  return (
    <div
      className={frameClass}
      style={frameStyle}
      data-custom-ad={ad.id}
      role="complementary"
      aria-label="Advertisement"
    >
      {content}
    </div>
  );
}
