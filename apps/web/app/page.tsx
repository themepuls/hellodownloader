import { fetchHomeContent } from '@/lib/fetch-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { HomePageClient } from '@/components/landing/HomePageClient';

export async function generateMetadata() {
  return buildPageMetadata({
    contentSlug: 'home',
    path: '/',
    fallbackTitle: 'HelloDownloader — AI Video Downloader',
  });
}

export default async function HomePage() {
  const content = await fetchHomeContent();
  return <HomePageClient content={content} />;
}
