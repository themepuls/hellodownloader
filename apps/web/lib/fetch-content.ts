import {
  mergePageSections,
  type HomePageContent,
  DEFAULT_HOME_CONTENT,
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

export async function fetchPageContent<T extends Record<string, unknown>>(
  slug: string,
  defaults: T,
): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/content/pages/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return defaults;
    const data = (await res.json()) as { sections?: Record<string, unknown> };
    return mergePageSections(slug, data.sections) as T;
  } catch {
    return defaults;
  }
}

export async function fetchPageContentOrThrow<T extends Record<string, unknown>>(
  slug: string,
  defaults: T,
): Promise<T> {
  const res = await fetch(`${API_URL}/content/pages/${slug}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error('Not found');
  const data = (await res.json()) as { sections?: Record<string, unknown> };
  return mergePageSections(slug, data.sections) as T;
}

export async function fetchHomeContent(): Promise<HomePageContent> {
  return fetchPageContent('home', DEFAULT_HOME_CONTENT);
}
