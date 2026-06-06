import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'terms',
    path: '/terms',
    fallbackTitle: 'Terms of Service',
  });
}

export default function TermsLayout({ children }: Props) {
  return children;
}
