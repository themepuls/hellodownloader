'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { AdsPublicConfig } from '@hellodownloader/shared-types';
import { DEFAULT_ADS_ADMIN_CONFIG, adsAdminToPublic } from '@hellodownloader/shared-types';

const defaultPublic = adsAdminToPublic(DEFAULT_ADS_ADMIN_CONFIG, true);

export function useAdsConfig() {
  const [config, setConfig] = useState<AdsPublicConfig>(defaultPublic);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void apiClient.ads
      .config()
      .then((data) => setConfig(data as AdsPublicConfig))
      .catch(() => setConfig(defaultPublic))
      .finally(() => setLoaded(true));
  }, []);

  return { config, loaded };
}
