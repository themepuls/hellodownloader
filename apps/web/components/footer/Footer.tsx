'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePageContent } from '@/hooks/usePageContent';
import {
  DEFAULT_FOOTER_CONTENT,
  mergeContent,
  type FooterContent,
} from '@hellodownloader/shared-types';

function normalizeFooter(raw: FooterContent): FooterContent {
  const base = mergeContent(DEFAULT_FOOTER_CONTENT, raw as unknown as Record<string, unknown>);
  return {
    brand: { ...DEFAULT_FOOTER_CONTENT.brand, ...base.brand },
    columns: (base.columns ?? DEFAULT_FOOTER_CONTENT.columns).map((col) => ({
      title: col.title,
      links: (col.links ?? []).filter((l) => l.label?.trim() && l.href?.trim()),
    })),
    copyright: base.copyright || DEFAULT_FOOTER_CONTENT.copyright,
  };
}

function formatCopyright(text: string) {
  return text.replace(/\{year\}/g, String(new Date().getFullYear()));
}

export function Footer() {
  const raw = usePageContent(
    'footer',
    DEFAULT_FOOTER_CONTENT as unknown as Record<string, unknown>,
  );
  const footer = normalizeFooter(raw as unknown as FooterContent);
  const brandName = footer.brand.text?.trim() || 'HelloDownloader';
  const logoUrl = footer.brand.imageUrl?.trim();
  const logoAlt = footer.brand.imageAlt?.trim() || brandName;
  const showBrandName = footer.brand.showBrandName !== false;

  return (
    <footer className="border-t border-white/5 bg-[#0b0e14] py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href={footer.brand.link || '/'} className="mb-4 flex items-center gap-2 font-bold" aria-label={brandName}>
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={logoAlt}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  {brandName.charAt(0).toUpperCase()}
                </div>
              )}
              {showBrandName && brandName}
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">{footer.brand.description}</p>
          </div>

          {footer.columns.map((col, i) => (
            <div key={`${col.title}-${i}`}>
              <h4 className="mb-4 font-semibold">{col.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link href={link.href} className="hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/5 pt-8 text-center">
          <p className="text-sm text-muted-foreground">{formatCopyright(footer.copyright)}</p>
        </div>
      </div>
    </footer>
  );
}
