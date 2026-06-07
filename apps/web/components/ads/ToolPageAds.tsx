'use client';

import { usePathname } from 'next/navigation';
import {
  activeCustomAds,
  hasProAccess,
  type CustomAdPage,
} from '@hellodownloader/shared-types';
import { isToolAdPage, resolveAdPageFromPath } from '@/lib/ad-page-path';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useUserStore } from '@/store/userStore';
import { PageAdsBottom, PageAdsSidebar, PageAdsTop } from '@/components/ads/PageAdsZones';

const TOOL_BOX = 'mx-auto w-full max-w-6xl px-4 sm:px-6';

function useShowToolAds(page: CustomAdPage) {
  const mounted = useClientMounted();
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) {
    return { showTop: false, showSidebar: false, showBottom: false };
  }

  const bannerEnabled = Boolean(config.banner?.enabled && config.banner);
  const hasTopCustom = activeCustomAds(config.customAds, { page, position: 'top' }).length > 0;
  const hasSidebar = activeCustomAds(config.customAds, { page, position: 'sidebar' }).length > 0;
  const hasBottom = activeCustomAds(config.customAds, { page, position: 'bottom' }).length > 0;

  return {
    showTop: hasTopCustom || bannerEnabled,
    showSidebar: hasSidebar,
    showBottom: hasBottom || bannerEnabled,
  };
}

/** Top banner inside the tool page box (below navbar). */
export function ToolPageAdsTop({ page }: { page: CustomAdPage }) {
  const { showTop } = useShowToolAds(page);
  if (!showTop) return null;

  return (
    <div className={TOOL_BOX}>
      <PageAdsTop page={page} />
    </div>
  );
}

/** Bottom ads inside the tool page box (above site footer). */
export function ToolPageAdsBottom({ page }: { page: CustomAdPage }) {
  const { showBottom } = useShowToolAds(page);
  if (!showBottom) return null;

  return (
    <div className={TOOL_BOX}>
      <PageAdsBottom page={page} />
    </div>
  );
}

type ToolPageWithSidebarProps = {
  page: CustomAdPage;
  children: React.ReactNode;
  className?: string;
};

/** Tool page main area: boxed content + sticky sidebar ads on desktop when configured. */
export function ToolPageWithSidebar({ page, children, className }: ToolPageWithSidebarProps) {
  const { showSidebar } = useShowToolAds(page);

  return (
    <div className={className ?? `${TOOL_BOX} py-8`}>
      {showSidebar ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">{children}</div>
          <aside className="min-w-0">
            <PageAdsSidebar page={page} className="sticky top-24 space-y-3" />
          </aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Popup + global scripts — only on download tool pages. */
export function useIsToolAdPage(): CustomAdPage | null {
  const pathname = usePathname() ?? '/';
  const page = resolveAdPageFromPath(pathname);
  return isToolAdPage(page) ? page : null;
}
