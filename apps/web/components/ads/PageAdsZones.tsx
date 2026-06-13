'use client';

import { type CustomAdPage } from '@hellodownloader/shared-types';
import { AdBannerSlot } from './AdBannerSlot';
import { CustomAdsSlot } from './CustomAdsSlot';

type PageAdsZoneProps = {
  page: CustomAdPage;
  className?: string;
};

/** Top banner zone: custom banner ads + network banner code. */
export function PageAdsTop({ page, className }: PageAdsZoneProps) {
  return (
    <div className={className}>
      <CustomAdsSlot page={page} position="top" />
      <AdBannerSlot placement={`${page}-top`} />
    </div>
  );
}

export function PageAdsSidebar({ page, className }: PageAdsZoneProps) {
  return <CustomAdsSlot page={page} position="sidebar" className={className} />;
}

/** Bottom zone: custom ads only (network banner stays top-only to avoid duplicates). */
export function PageAdsBottom({ page, className }: PageAdsZoneProps) {
  return (
    <div className={className}>
      <CustomAdsSlot page={page} position="bottom" />
    </div>
  );
}
