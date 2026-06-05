import { notFound } from 'next/navigation';
import { fetchPageContentOrThrow } from '@/lib/fetch-content';
import { DEFAULT_SIMPLE_PAGE, PAGE_DEFAULTS } from '@hellodownloader/shared-types';

const BUILT_IN = new Set(Object.keys(PAGE_DEFAULTS));

type Props = { params: Promise<{ slug: string }> };

export default async function CustomContentPage({ params }: Props) {
  const { slug } = await params;
  if (BUILT_IN.has(slug)) notFound();

  try {
    const sections = await fetchPageContentOrThrow(slug, DEFAULT_SIMPLE_PAGE);
    const title = String(sections.title ?? 'Page');
    const body = String(sections.body ?? '');

    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-8">{title}</h1>
        <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {body}
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
