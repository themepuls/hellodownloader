import { Injectable } from '@nestjs/common';
import { adsAdminToPublic, hasProAccess, type AdsAdminConfig } from '@hellodownloader/shared-types';
import { AdsSettingsService } from '../ads-settings/ads-settings.service';

@Injectable()
export class AdsService {
  constructor(private adsSettings: AdsSettingsService) {}

  async getAdConfig(plan: string, role?: string) {
    const showAds = !hasProAccess(plan, role);
    const admin = await this.adsSettings.getAdmin();
    return adsAdminToPublic(admin, showAds);
  }

  getAdminConfig() {
    return this.adsSettings.getAdmin();
  }

  updateAdminConfig(patch: Partial<AdsAdminConfig>) {
    return this.adsSettings.updateAdmin(patch);
  }
}
