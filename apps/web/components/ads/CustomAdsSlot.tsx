'use client';

import Image from 'next/image';
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
import { BANNER_AD_MARGIN } from './ad-banner-styles';

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

  const banners = items.filter((item) => item.format === 'banner');
  const squares = items.filter((item) => item.format === 'square');

  return (
    <div className={className ?? 'space-y-3'}>
      {banners.map((ad) => (
        <CustomAdCard key={ad.id} ad={ad} />
      ))}
      {squares.map((ad) => (
        <CustomAdCard key={ad.id} ad={ad} />
      ))}
    </div>
  );
}

function CustomAdCard({ ad }: { ad: CustomAdItem }) {
  const isBanner = ad.format === 'banner';
  const frameClass = isBanner
    ? `${BANNER_AD_MARGIN} relative w-full overflow-hidden rounded-xl border border-border bg-card/80 aspect-[728/90] min-h-[72px]`
    : 'relative w-full overflow-hidden rounded-xl border border-border bg-card/80 aspect-square max-w-[320px] mx-auto lg:mx-0';

  const image = (
    <Image
      src={ad.imageUrl}
      alt={ad.title.trim() || 'Advertisement'}
      fill
      className="object-cover"
      unoptimized
      sizes={isBanner ? '100vw' : '320px'}
    />
  );

  const content = ad.linkUrl.trim() ? (
    <a
      href={ad.linkUrl.trim()}
      target={ad.openInNewTab ? '_blank' : '_self'}
      rel={ad.openInNewTab ? 'noopener noreferrer sponsored' : undefined}
      className="block h-full w-full"
    >
      {image}
    </a>
  ) : (
    image
  );

  return (
    <div className={frameClass} data-custom-ad={ad.id} role="complementary" aria-label="Advertisement">
      {content}
    </div>
  );
}
