'use client';

import { LegalPageClient } from '@/components/content/LegalPageClient';
import { DEFAULT_DMCA_CONTENT } from '@hellodownloader/shared-types';

export default function DmcaPage() {
  return <LegalPageClient slug="dmca" defaults={DEFAULT_DMCA_CONTENT} />;
}
