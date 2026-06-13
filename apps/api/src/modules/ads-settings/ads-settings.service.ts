import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_ADS_ADMIN_CONFIG,
  normalizeAffiliateUrl,
  normalizeCustomAds,
  normalizeCustomAdsBannerHeightPx,
  type AdsAdminConfig,
} from '@hellodownloader/shared-types';
import { PrismaService } from '../../database/prisma.service';

function mergeAdsConfig(current: AdsAdminConfig, patch: Partial<AdsAdminConfig>): AdsAdminConfig {
  return {
    ...current,
    ...patch,
    popupDelayMs: Math.max(0, patch.popupDelayMs ?? current.popupDelayMs),
    creditsReward: Math.max(1, patch.creditsReward ?? current.creditsReward),
    customAdsBannerHeightPx: normalizeCustomAdsBannerHeightPx(
      patch.customAdsBannerHeightPx ?? current.customAdsBannerHeightPx,
    ),
    customAds: patch.customAds ? normalizeCustomAds(patch.customAds) : current.customAds,
    affiliateLinkDownload:
      patch.affiliateLinkDownload !== undefined
        ? normalizeAffiliateUrl(patch.affiliateLinkDownload)
        : current.affiliateLinkDownload,
    affiliateLinkAudio:
      patch.affiliateLinkAudio !== undefined
        ? normalizeAffiliateUrl(patch.affiliateLinkAudio)
        : current.affiliateLinkAudio,
    affiliateLinkSubtitle:
      patch.affiliateLinkSubtitle !== undefined
        ? normalizeAffiliateUrl(patch.affiliateLinkSubtitle)
        : current.affiliateLinkSubtitle,
    affiliateLinkThumbnail:
      patch.affiliateLinkThumbnail !== undefined
        ? normalizeAffiliateUrl(patch.affiliateLinkThumbnail)
        : current.affiliateLinkThumbnail,
    affiliateLinkPlaylist:
      patch.affiliateLinkPlaylist !== undefined
        ? normalizeAffiliateUrl(patch.affiliateLinkPlaylist)
        : current.affiliateLinkPlaylist,
  };
}

function applyEnvOverrides(config: AdsAdminConfig): AdsAdminConfig {
  return {
    ...config,
    customAds: normalizeCustomAds(config.customAds),
    customAdsBannerHeightPx: normalizeCustomAdsBannerHeightPx(config.customAdsBannerHeightPx),
    affiliateLinkDownload: normalizeAffiliateUrl(config.affiliateLinkDownload),
    affiliateLinkAudio: normalizeAffiliateUrl(config.affiliateLinkAudio),
    affiliateLinkSubtitle: normalizeAffiliateUrl(config.affiliateLinkSubtitle),
    affiliateLinkThumbnail: normalizeAffiliateUrl(config.affiliateLinkThumbnail),
    affiliateLinkPlaylist: normalizeAffiliateUrl(config.affiliateLinkPlaylist),
    bannerSlotId: process.env.AD_BANNER_SLOT ?? config.bannerSlotId,
    popupSlotId: process.env.AD_POPUP_SLOT ?? config.popupSlotId,
    rewardedSlotId: process.env.AD_REWARDED_SLOT ?? config.rewardedSlotId,
  };
}

function mergeWithDefaults(stored: Partial<AdsAdminConfig> | null | undefined): AdsAdminConfig {
  return { ...DEFAULT_ADS_ADMIN_CONFIG, ...(stored ?? {}) };
}

function hasPersistedAds(config: Partial<AdsAdminConfig>): boolean {
  if (config.customAds?.length) return true;
  if (config.bannerAdTag?.trim() || config.bannerHtml?.trim()) return true;
  if (config.popupAdTag?.trim() || config.popupHtml?.trim()) return true;
  if (config.globalAdTag?.trim() || config.globalHeadHtml?.trim()) return true;
  return false;
}

@Injectable()
export class AdsSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AdsSettingsService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.syncFromFileBackupIfNeeded();
  }

  private configFilePath(): string {
    const base = path.resolve(process.env.STORAGE_PATH ?? './storage');
    return path.join(base, 'ads-config.json');
  }

  private readFileBackup(): Partial<AdsAdminConfig> | null {
    try {
      const filePath = this.configFilePath();
      if (!fs.existsSync(filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<AdsAdminConfig>;
      return hasPersistedAds(parsed) ? parsed : null;
    } catch (err) {
      this.logger.warn(
        `Could not read ads file backup: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private writeFileBackup(config: AdsAdminConfig): void {
    try {
      const filePath = this.configFilePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      this.logger.warn(
        `Could not write ads file backup: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async ensureDefaults() {
    try {
      await this.prisma.adsSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          config: DEFAULT_ADS_ADMIN_CONFIG as object,
        },
        update: {},
      });
    } catch (err) {
      this.logger.warn(
        `ads_settings table unavailable — using file backup only until db:push runs: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  /** Restore DB from storage/ads-config.json when DB row is empty after deploy. */
  private async syncFromFileBackupIfNeeded() {
    const backup = this.readFileBackup();
    if (!backup) return;

    try {
      const row = await this.prisma.adsSettings.findUnique({ where: { id: 1 } });
      const stored = mergeWithDefaults((row?.config ?? {}) as Partial<AdsAdminConfig>);
      if (hasPersistedAds(stored)) return;

      const restored = applyEnvOverrides(mergeWithDefaults(backup));
      await this.prisma.adsSettings.update({
        where: { id: 1 },
        data: { config: restored as object },
      });
      this.logger.log('Restored ad settings from storage/ads-config.json');
    } catch {
      // DB not ready — file backup still used on read
    }
  }

  async getAdmin(): Promise<AdsAdminConfig> {
    let stored: Partial<AdsAdminConfig> | null = null;

    try {
      const row = await this.prisma.adsSettings.findUnique({ where: { id: 1 } });
      if (row) {
        stored = (row.config ?? {}) as Partial<AdsAdminConfig>;
      } else {
        await this.ensureDefaults();
      }
    } catch {
      stored = null;
    }

    const backup = this.readFileBackup();
    const merged = mergeWithDefaults(stored ?? backup);
    const dbEmpty = !hasPersistedAds(stored ?? {});
    const fileHasData = Boolean(backup && hasPersistedAds(backup));

    if (dbEmpty && fileHasData) {
      return applyEnvOverrides(mergeWithDefaults(backup));
    }

    return applyEnvOverrides(merged);
  }

  async updateAdmin(patch: Partial<AdsAdminConfig>): Promise<AdsAdminConfig> {
    const current = await this.getAdmin();
    const next = applyEnvOverrides(mergeAdsConfig(current, patch));

    try {
      await this.prisma.adsSettings.upsert({
        where: { id: 1 },
        create: { id: 1, config: next as object },
        update: { config: next as object },
      });
    } catch (err) {
      this.logger.warn(
        `Could not save ads to database — wrote file backup only: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    this.writeFileBackup(next);
    return next;
  }
}
