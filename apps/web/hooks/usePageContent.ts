'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { mergePageSections } from '@hellodownloader/shared-types';

/** Always returns a merged object — never undefined. */
export function usePageContent<T extends Record<string, unknown>>(
  slug: string,
  defaults: T,
): T {
  const [content, setContent] = useState<T>(() => defaults);

  useEffect(() => {
    let cancelled = false;

    apiClient.content
      .page(slug)
      .then((data) => {
        if (cancelled) return;
        const row = data as { sections?: Record<string, unknown> };
        const merged = mergePageSections(slug, row?.sections ?? {}) as T;
        setContent(merged ?? defaults);
      })
      .catch(() => {
        if (!cancelled) setContent(defaults);
      });

    return () => {
      cancelled = true;
    };
    // defaults is a stable module constant from callers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return content ?? defaults;
}
