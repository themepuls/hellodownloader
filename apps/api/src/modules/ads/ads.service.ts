import { Injectable } from '@nestjs/common';
import { adsAdminToPublic, hasProAccess } from '@hellodownloader/shared-types';
import { adminRuntimeConfig } from '../admin/admin-config';

@Injectable()
export class AdsService {
  getAdConfig(plan: string, role?: string) {
    const showAds = !hasProAccess(plan, role);
    const admin = adminRuntimeConfig.getAdsAdminConfig();
    return adsAdminToPublic(admin, showAds);
  }

  getAdminConfig() {
    return adminRuntimeConfig.getAdsAdminConfig();
  }

  updateAdminConfig(patch: Parameters<typeof adminRuntimeConfig.setAdsAdminConfig>[0]) {
    const next = adminRuntimeConfig.setAdsAdminConfig(patch);
    return next;
  }
}
