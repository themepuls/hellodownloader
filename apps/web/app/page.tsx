import { HomeHero } from '@/components/landing/HomeHero';
import { HomeSections } from '@/components/landing/HomeSections';
import { fetchHomeContent } from '@/lib/fetch-content';

export default async function HomePage() {
  const content = await fetchHomeContent();

  return (
    <div className="bg-[#0b0e14]">
      <HomeHero hero={content.hero} />
      <HomeSections content={content} />
    </div>
  );
}
