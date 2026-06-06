'use client';

import { LegalPageClient } from '@/components/content/LegalPageClient';
import { DEFAULT_TERMS_CONTENT } from '@hellodownloader/shared-types';

export default function TermsPage() {
  return <LegalPageClient slug="terms" defaults={DEFAULT_TERMS_CONTENT} />;
}
