import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'dmca',
    path: '/dmca',
    fallbackTitle: 'DMCA',
  });
}

export default function DmcaLayout({ children }: Props) {
  return children;
}
