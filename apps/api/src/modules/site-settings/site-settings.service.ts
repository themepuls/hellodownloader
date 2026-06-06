import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  normalizeVerificationFiles,
  toSiteSettingsPublic,
  type SiteSettingsAdmin,
  type SiteSettingsPublic,
  type VerificationFile,
} from '@hellodownloader/shared-types';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SiteSettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  private async ensureDefaults() {
    const defaults = DEFAULT_SITE_SETTINGS;
    await this.prisma.siteSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        siteName: defaults.siteName,
        siteUrl: defaults.siteUrl,
        titleTemplate: defaults.titleTemplate,
        defaultMetaTitle: defaults.defaultMetaTitle,
        defaultMetaDescription: defaults.defaultMetaDescription,
        defaultKeywords: defaults.defaultKeywords,
        defaultOgImage: defaults.defaultOgImage,
        faviconUrl: defaults.faviconUrl,
        globalHeadHtml: defaults.globalHeadHtml,
        globalHeadJs: defaults.globalHeadJs,
        globalCss: defaults.globalCss,
        globalBodyJs: defaults.globalBodyJs,
        googleSiteVerification: defaults.googleSiteVerification,
        bingSiteVerification: defaults.bingSiteVerification,
        customHeadSnippet: defaults.customHeadSnippet,
        verificationFiles: defaults.verificationFiles as object,
        routeSeo: defaults.routeSeo as object,
        googleAuthEnabled: false,
        googleClientId: '',
      },
      update: {},
    });
  }

  private rowToPublic(row: {
    siteName: string;
    siteUrl: string;
    titleTemplate: string;
    defaultMetaTitle: string;
    defaultMetaDescription: string;
    defaultKeywords: string;
    defaultOgImage: string;
    faviconUrl: string;
    globalHeadHtml: string;
    globalHeadJs: string;
    globalCss: string;
    globalBodyJs: string;
    googleSiteVerification: string;
    bingSiteVerification: string;
    customHeadSnippet: string;
    verificationFiles: unknown;
    routeSeo: unknown;
    googleAuthEnabled: boolean;
    googleClientId: string;
  }): SiteSettingsAdmin {
    return normalizeSiteSettings({
      siteName: row.siteName,
      siteUrl: row.siteUrl,
      titleTemplate: row.titleTemplate,
      defaultMetaTitle: row.defaultMetaTitle || DEFAULT_SITE_SETTINGS.defaultMetaTitle,
      defaultMetaDescription:
        row.defaultMetaDescription || DEFAULT_SITE_SETTINGS.defaultMetaDescription,
      defaultKeywords: row.defaultKeywords || DEFAULT_SITE_SETTINGS.defaultKeywords,
      defaultOgImage: row.defaultOgImage,
      faviconUrl: row.faviconUrl,
      globalHeadHtml: row.globalHeadHtml,
      globalHeadJs: row.globalHeadJs,
      globalCss: row.globalCss,
      globalBodyJs: row.globalBodyJs,
      googleSiteVerification: row.googleSiteVerification,
      bingSiteVerification: row.bingSiteVerification,
      customHeadSnippet: row.customHeadSnippet,
      verificationFiles: (row.verificationFiles as VerificationFile[] | null) ?? [],
      routeSeo: (row.routeSeo as SiteSettingsPublic['routeSeo'] | null) ?? {},
      googleAuthEnabled: row.googleAuthEnabled,
      googleClientId: row.googleClientId,
    });
  }

  async getPublic(): Promise<SiteSettingsPublic> {
    const admin = await this.getAdmin();
    return toSiteSettingsPublic(admin);
  }

  async getAdmin(): Promise<SiteSettingsAdmin> {
    const row = await this.prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      await this.ensureDefaults();
      return normalizeSiteSettings(DEFAULT_SITE_SETTINGS);
    }
    return this.rowToPublic(row);
  }

  async getGoogleOAuthConfig(): Promise<{ enabled: boolean; clientId: string }> {
    const fromEnv = process.env.GOOGLE_CLIENT_ID?.trim();
    if (fromEnv) {
      return { enabled: true, clientId: fromEnv };
    }

    const row = await this.prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (!row?.googleAuthEnabled) {
      return { enabled: false, clientId: '' };
    }

    const clientId = row.googleClientId.trim();
    return { enabled: Boolean(clientId), clientId };
  }

  async updateAdmin(patch: Partial<SiteSettingsAdmin>): Promise<SiteSettingsAdmin> {
    const current = await this.getAdmin();
    const next = normalizeSiteSettings({ ...current, ...patch });

    await this.prisma.siteSettings.update({
      where: { id: 1 },
      data: {
        siteName: next.siteName,
        siteUrl: next.siteUrl,
        titleTemplate: next.titleTemplate,
        defaultMetaTitle: next.defaultMetaTitle,
        defaultMetaDescription: next.defaultMetaDescription,
        defaultKeywords: next.defaultKeywords,
        defaultOgImage: next.defaultOgImage,
        faviconUrl: next.faviconUrl,
        globalHeadHtml: next.globalHeadHtml,
        globalHeadJs: next.globalHeadJs,
        globalCss: next.globalCss,
        globalBodyJs: next.globalBodyJs,
        googleSiteVerification: next.googleSiteVerification,
        bingSiteVerification: next.bingSiteVerification,
        customHeadSnippet: next.customHeadSnippet,
        verificationFiles: normalizeVerificationFiles(next.verificationFiles) as object,
        routeSeo: next.routeSeo as object,
        googleAuthEnabled: next.googleAuthEnabled,
        googleClientId: next.googleClientId,
      },
    });

    return this.getAdmin();
  }

  async getVerificationFile(filename: string): Promise<string> {
    const settings = await this.getPublic();
    const normalized = filename.replace(/^\/+/, '');
    const file = settings.verificationFiles.find((f) => f.filename === normalized);
    if (!file) throw new NotFoundException('Verification file not found');
    return file.content;
  }
}
