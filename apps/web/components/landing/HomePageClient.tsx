'use client';

import { HomeHero } from '@/components/landing/HomeHero';
import { HomeSections } from '@/components/landing/HomeSections';
import type { HomePageContent } from '@hellodownloader/shared-types';

export function HomePageClient({ content }: { content: HomePageContent }) {
  return (
    <div className="overflow-x-hidden bg-background">
      <HomeHero hero={content.hero} />
      <HomeSections content={content} />
    </div>
  );
}
