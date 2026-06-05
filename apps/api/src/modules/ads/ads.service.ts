import { Injectable } from '@nestjs/common';

@Injectable()
export class AdsService {
  getAdConfig(plan: string) {
    const showAds = plan !== 'PRO';
    return {
      showAds,
      banner: showAds ? { slotId: process.env.AD_BANNER_SLOT ?? 'banner-1', enabled: true } : null,
      popup: showAds ? { slotId: process.env.AD_POPUP_SLOT ?? 'popup-1', enabled: true, delayMs: 30000 } : null,
      rewarded: showAds ? { slotId: process.env.AD_REWARDED_SLOT ?? 'rewarded-1', creditsReward: 1 } : null,
    };
  }
}
