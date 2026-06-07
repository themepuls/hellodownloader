'use client';

import { useCallback } from 'react';
import type { AffiliateLinkPage } from '@hellodownloader/shared-types';
import { openAffiliateForPage } from '@/lib/affiliate-link';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useUserStore } from '@/store/userStore';

/** Opens the configured affiliate link in a new tab (free users only). */
export function useAffiliateOnSave(page: AffiliateLinkPage) {
  const { config, loaded } = useAdsConfig();
  const user = useUserStore((s) => s.user);

  return useCallback(() => {
    if (!loaded) return;
    openAffiliateForPage(config, page, user?.plan, user?.role);
  }, [config, loaded, page, user?.plan, user?.role]);
}
