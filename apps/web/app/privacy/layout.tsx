import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'privacy',
    path: '/privacy',
    fallbackTitle: 'Privacy Policy',
  });
}

export default function PrivacyLayout({ children }: Props) {
  return children;
}
