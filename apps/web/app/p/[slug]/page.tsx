import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ContentPageClient } from '@/components/content/ContentPageClient';
import { fetchPageContentOrThrow } from '@/lib/fetch-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { DEFAULT_SIMPLE_PAGE, PAGE_DEFAULTS } from '@hellodownloader/shared-types';

const BUILT_IN = new Set(Object.keys(PAGE_DEFAULTS));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (BUILT_IN.has(slug)) return {};
  return buildPageMetadata({
    contentSlug: slug,
    path: `/p/${slug}`,
    fallbackTitle: slug,
  });
}

export default async function CustomContentPage({ params }: Props) {
  const { slug } = await params;
  if (BUILT_IN.has(slug)) notFound();

  try {
    const sections = await fetchPageContentOrThrow(slug, DEFAULT_SIMPLE_PAGE);
    const title = String(sections.title ?? 'Page');
    const body = String(sections.body ?? '');

    return <ContentPageClient title={title} body={body} />;
  } catch {
    notFound();
  }
}
