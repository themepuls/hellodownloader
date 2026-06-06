'use client';

import { usePageContent } from '@/hooks/usePageContent';
import type { SimplePageContent } from '@hellodownloader/shared-types';

type LegalPageClientProps = {
  slug: 'terms' | 'privacy' | 'dmca';
  defaults: SimplePageContent;
};

export function LegalPageClient({ slug, defaults }: LegalPageClientProps) {
  const content = usePageContent<SimplePageContent>(slug, defaults);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">{content.title}</h1>
      <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {content.body}
      </div>
    </div>
  );
}
