'use client';

import { usePageContent } from '@/hooks/usePageContent';
import { DEFAULT_FAQ_CONTENT, type FaqPageContent } from '@hellodownloader/shared-types';

export default function FaqPage() {
  const content = usePageContent<FaqPageContent>('faq', DEFAULT_FAQ_CONTENT);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">{content.title}</h1>
        <p className="text-muted-foreground text-lg">{content.subtitle}</p>
      </div>

      <div className="space-y-4">
        {content.items.map((item, i) => (
          <details
            key={`${item.question}-${i}`}
            className="group rounded-xl border border-white/10 bg-card p-5 open:border-primary/30"
          >
            <summary className="cursor-pointer font-medium list-none flex items-center justify-between gap-4">
              {item.question}
              <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
