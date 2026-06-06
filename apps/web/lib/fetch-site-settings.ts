import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettingsPublic,
} from '@hellodownloader/shared-types';

function resolveServerApiUrl(): string {
  const publicBase = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
  if (publicBase) return `${publicBase}/api/v1`;
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured?.startsWith('http')) return configured.replace(/\/$/, '');
  return 'http://127.0.0.1:4001/api/v1';
}

const API_URL =
  typeof window === 'undefined'
    ? resolveServerApiUrl()
    : (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1');

export async function fetchSiteSettings(): Promise<SiteSettingsPublic> {
  try {
    const res = await fetch(`${API_URL}/content/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return DEFAULT_SITE_SETTINGS;
    const data = (await res.json()) as SiteSettingsPublic;
    return normalizeSiteSettings(data);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
