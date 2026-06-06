import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    routeKey: 'playlist',
    path: '/playlist',
    fallbackTitle: 'Playlist Downloader',
  });
}

export default function PlaylistLayout({ children }: Props) {
  return children;
}
