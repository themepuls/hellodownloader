export type PageSeoContent = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
  noIndex: boolean;
  canonicalUrl: string;
};

export type SiteSettingsPublic = {
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
  /** Paste full HTML snippet (meta, script, link) for any verification or head code. */
  customHeadSnippet: string;
  /** Optional verification files served at /{filename} e.g. google123.html */
  verificationFiles: VerificationFile[];
  /** SEO for routes without a CMS content page (e.g. playlist, login). */
  routeSeo: Record<string, Partial<PageSeoContent>>;
  /** Paths blocked in robots.txt (one rule set for all crawlers). */
  robotsDisallow: string[];
};

export const DEFAULT_ROBOTS_DISALLOW = [
  '/admin/',
  '/dashboard/',
  '/login',
  '/register',
  '/billing/',
  '/settings/',
  '/profile/',
  '/credits/',
] as const;

export function normalizeRobotsDisallow(paths: string[] | undefined | null): string[] {
  if (!paths?.length) return [...DEFAULT_ROBOTS_DISALLOW];
  return paths.map((p) => p.trim()).filter(Boolean);
}

export type VerificationFile = {
  filename: string;
  content: string;
};

export type SiteSettingsAdmin = SiteSettingsPublic & {
  googleAuthEnabled: boolean;
  googleClientId: string;
};

export const DEFAULT_PAGE_SEO: PageSeoContent = {
  metaTitle: '',
  metaDescription: '',
  keywords: '',
  ogImage: '',
  ogTitle: '',
  ogDescription: '',
  noIndex: false,
  canonicalUrl: '',
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsPublic = {
  siteName: 'HelloDownloader',
  siteUrl: '',
  titleTemplate: '%s | HelloDownloader',
  defaultMetaTitle: 'HelloDownloader — AI Video Downloader',
  defaultMetaDescription:
    'Free video & playlist downloads up to 720p, MP3, subtitles. Pro: AI thumbnails, 4K, no ads.',
  defaultKeywords: 'video downloader, youtube downloader, playlist download, mp3, subtitles',
  defaultOgImage: '',
  faviconUrl: '',
  globalHeadHtml: '',
  globalHeadJs: '',
  globalCss: '',
  globalBodyJs: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
  customHeadSnippet: '',
  verificationFiles: [],
  routeSeo: {
    playlist: {
      metaTitle: 'Playlist Downloader — Export YouTube Playlists as ZIP',
      metaDescription: 'Download full YouTube playlists up to 720p and export as ZIP. Free for all users.',
    },
    login: {
      metaTitle: 'Log In',
      metaDescription: 'Sign in to HelloDownloader to save download history and access your account.',
      noIndex: true,
    },
    register: {
      metaTitle: 'Sign Up',
      metaDescription: 'Create a free HelloDownloader account.',
      noIndex: true,
    },
    dashboard: {
      metaTitle: 'Dashboard',
      metaDescription: 'Your HelloDownloader account dashboard.',
      noIndex: true,
    },
  },
  robotsDisallow: [...DEFAULT_ROBOTS_DISALLOW],
};

export function mergePageSeo(partial?: Partial<PageSeoContent> | null): PageSeoContent {
  return { ...DEFAULT_PAGE_SEO, ...(partial ?? {}) };
}

export function normalizeVerificationFiles(
  files: VerificationFile[] | undefined | null,
): VerificationFile[] {
  if (!files?.length) return [];
  return files
    .filter((f) => f.filename.trim() && f.content.trim())
    .map((f) => ({
      filename: f.filename.trim().replace(/^\/+/, ''),
      content: f.content,
    }));
}

export const DEFAULT_GOOGLE_AUTH_SETTINGS = {
  googleAuthEnabled: false,
  googleClientId: '',
} as const;

export function normalizeSiteSettings(
  partial?: Partial<SiteSettingsAdmin> | null,
): SiteSettingsAdmin {
  const base = { ...DEFAULT_SITE_SETTINGS, ...DEFAULT_GOOGLE_AUTH_SETTINGS, ...(partial ?? {}) };
  return {
    ...base,
    verificationFiles: normalizeVerificationFiles(base.verificationFiles),
    routeSeo: base.routeSeo ?? DEFAULT_SITE_SETTINGS.routeSeo,
    robotsDisallow: normalizeRobotsDisallow(base.robotsDisallow),
    googleAuthEnabled: Boolean(base.googleAuthEnabled),
    googleClientId: (base.googleClientId ?? '').trim(),
  };
}

export function toSiteSettingsPublic(settings: SiteSettingsAdmin): SiteSettingsPublic {
  const { googleAuthEnabled: _enabled, googleClientId: _clientId, ...publicFields } = settings;
  return publicFields;
}
