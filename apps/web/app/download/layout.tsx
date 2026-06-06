import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'download',
    path: '/download',
    fallbackTitle: 'Video Downloader',
  });
}

export default function DownloadLayout({ children }: Props) {
  return children;
}
