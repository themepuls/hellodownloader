import {
  mergePageSections,
  type HomePageContent,
  DEFAULT_HOME_CONTENT,
} from '@hellodownloader/shared-types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window === 'undefined' ? 'http://localhost:4000/api/v1' : '/api/v1');

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
