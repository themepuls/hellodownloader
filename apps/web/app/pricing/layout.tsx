import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

type Props = { children: React.ReactNode };

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    contentSlug: 'pricing',
    path: '/pricing',
    fallbackTitle: 'Pricing',
  });
}

export default function PricingLayout({ children }: Props) {
  return children;
}
