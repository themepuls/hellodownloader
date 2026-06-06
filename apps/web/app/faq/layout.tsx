import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'faq',
    path: '/faq',
    fallbackTitle: 'FAQ',
    fallbackDescription: 'Frequently asked questions about HelloDownloader.',
  });
}

export default function FaqLayout({ children }: Props) {
  return children;
}
