import { Injectable } from '@nestjs/common';

import { adminRuntimeConfig } from '../admin/admin-config';

@Injectable()
export class AdsService {
  getAdConfig(plan: string) {
    const showAds = plan !== 'PRO';
    const ads = adminRuntimeConfig.getAds();
    return {
      showAds,
      banner: showAds && ads.bannerEnabled ? { slotId: process.env.AD_BANNER_SLOT ?? 'banner-1', enabled: true } : null,
      popup: showAds && ads.popupEnabled ? { slotId: process.env.AD_POPUP_SLOT ?? 'popup-1', enabled: true, delayMs: 30000 } : null,
      rewarded: showAds && ads.rewardedEnabled ? { slotId: process.env.AD_REWARDED_SLOT ?? 'rewarded-1', creditsReward: ads.creditsReward } : null,
    };
  }
}
