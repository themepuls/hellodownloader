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

  return (
    <div className={className ?? 'space-y-4'}>
      {items.map((ad) => (
        <CustomAdCard key={ad.id} ad={ad} position={position} />
      ))}
    </div>
  );
}

function CustomAdCard({ ad, position }: { ad: CustomAdItem; position: CustomAdPosition }) {
  const isBannerSlot = ad.format === 'banner' || position === 'top' || position === 'bottom';
  const isSidebar = position === 'sidebar';

  const frameClass = cn(
    'relative w-full overflow-hidden rounded-lg border border-border/40 bg-muted/15',
    isBannerSlot && 'mx-auto h-[90px] max-w-full',
    isSidebar && !isBannerSlot && 'mx-auto aspect-square max-h-[220px] max-w-[220px]',
    isSidebar && isBannerSlot && 'h-auto min-h-[120px] max-h-[280px] aspect-[4/5]',
  );

  const image = (
    <Image
      src={ad.imageUrl}
      alt={ad.title.trim() || 'Advertisement'}
      fill
      className="object-contain p-1.5"
      unoptimized
      sizes={isBannerSlot ? '(max-width: 768px) 100vw, 728px' : '240px'}
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
