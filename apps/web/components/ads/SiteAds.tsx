'use client';

import { hasProAccess } from '@hellodownloader/shared-types';
import { hasAdContent } from '@/lib/ad-tag-parser';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useUserStore } from '@/store/userStore';
import { useIsToolAdPage } from '@/components/ads/ToolPageAds';
import { AdGlobalScripts } from './AdGlobalScripts';
import { PopupAd } from './PopupAd';

/** Popup + global scripts — download tool pages only. */
export function SiteAds() {
  const mounted = useClientMounted();
  const toolPage = useIsToolAdPage();
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  if (!mounted || !toolPage || !loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) {
    return null;
  }

  const popup = config.popup;
  const showPopup =
    Boolean(popup?.enabled) &&
    hasAdContent(popup?.adTag ?? '', popup?.html ?? '', popup?.css ?? '', popup?.js ?? '');

  return (
    <>
      <AdGlobalScripts />
      {showPopup && popup ? (
        <PopupAd
          delayMs={popup.delayMs}
          slotId={popup.slotId}
          adTag={popup.adTag}
          html={popup.html}
          css={popup.css}
          js={popup.js}
        />
      ) : null}
    </>
  );
}
