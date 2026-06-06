'use client';

import { LegalPageClient } from '@/components/content/LegalPageClient';
import { DEFAULT_PRIVACY_CONTENT } from '@hellodownloader/shared-types';

export default function PrivacyPage() {
  return <LegalPageClient slug="privacy" defaults={DEFAULT_PRIVACY_CONTENT} />;
}
