import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'tools',
    path: '/thumbnail',
    fallbackTitle: 'Thumbnail Tools',
  });
}

export default function ThumbnailLayout({ children }: Props) {
  return children;
}
