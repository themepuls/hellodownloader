import { HomeHero } from '@/components/landing/HomeHero';
import { HomeSections } from '@/components/landing/HomeSections';

export default function HomePage() {
  return (
    <div className="bg-[#0b0e14]">
      <HomeHero />
      <HomeSections />
    </div>
  );
}
