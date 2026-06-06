'use client';

import type { CustomAdPage } from '@hellodownloader/shared-types';
import { PageAdsSidebar } from '@/components/ads/PageAdsZones';

type PublicPageAdsLayoutProps = {
  page: CustomAdPage;
  children: React.ReactNode;
  /**
   * full — main content uses full container width; sidebar ads render below (pricing, faq, legal).
   * aside — main content + sticky sidebar column (download tools).
   */
  variant?: 'full' | 'aside';
  className?: string;
  /** Show page sidebar ads (zone: sidebar). Top/bottom ads come from site layout. */
  showSidebarAds?: boolean;
};

/**
 * Page wrapper for custom sidebar ads.
 * Top/bottom ads are injected globally via SiteRouteAdsTop/Bottom in layout.
 */
export function PublicPageAdsLayout({
  page,
  children,
  variant = 'full',
  className,
  showSidebarAds = true,
}: PublicPageAdsLayoutProps) {
  const containerClass = className ?? 'container mx-auto px-4 py-8 max-w-5xl';

  if (variant === 'aside') {
    return (
      <div className={containerClass}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">{children}</div>
          {showSidebarAds ? (
            <aside className="min-w-0">
              <PageAdsSidebar page={page} className="sticky top-24 space-y-3" />
            </aside>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {children}
      {showSidebarAds ? (
        <div className="mt-10 border-t border-border/60 pt-8">
          <PageAdsSidebar page={page} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
        </div>
      ) : null}
    </div>
  );
}
