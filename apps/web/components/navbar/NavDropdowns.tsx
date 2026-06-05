'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavLinkItem, NavMenuItem } from '@hellodownloader/shared-types';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

export function NavMenuDropdown({
  item,
  pathname,
}: {
  item: NavMenuItem;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const children = (item.children ?? []).filter((c) => c.label?.trim() && c.href?.trim());
  const hasChildren = children.length > 0;
  const isActive =
    (item.href && pathname === item.href) ||
    item.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));

  if (!hasChildren) {
    return (
      <Link
        href={item.href ?? '#'}
        className={cn(
          'rounded-lg px-3 py-2 text-sm transition-colors',
          pathname === item.href
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {item.label}
        <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-white/10 bg-[#12151c] py-1 shadow-xl">
          {children.map((child) => (
            <Link
              key={`${child.label}-${child.href}`}
              href={child.href}
              onClick={() => setOpen(false)}
              className={cn(
                'block px-4 py-2.5 text-sm transition-colors hover:bg-white/5',
                pathname === child.href ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountDropdown({
  accountLabel,
  dashboardText,
  dashboardLink,
  adminText,
  adminLink,
  logoutText,
  isAdmin,
  onLogout,
  userLabel,
}: {
  accountLabel: string;
  dashboardText: string;
  dashboardLink: string;
  adminText: string;
  adminLink: string;
  logoutText: string;
  isAdmin: boolean;
  onLogout: () => void;
  userLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/5 transition-colors"
      >
        <span className="max-w-[120px] truncate hidden sm:inline">{userLabel ?? accountLabel}</span>
        <span className="sm:hidden">{accountLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-white/10 bg-[#12151c] py-1 shadow-xl">
          <Link
            href={dashboardLink}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            {dashboardText}
          </Link>
          {isAdmin && (
            <Link
              href={adminLink}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-primary hover:bg-white/5"
            >
              {adminText}
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            {logoutText}
          </button>
        </div>
      )}
    </div>
  );
}

export function HeaderLogo({
  imageUrl,
  imageAlt,
  text,
  link,
  showBrandName,
}: {
  imageUrl: string;
  imageAlt: string;
  text: string;
  link: string;
  showBrandName: boolean;
}) {
  const brand = text?.trim() || 'HelloDownloader';
  const home = link?.trim() || '/';
  const alt = imageAlt?.trim() || brand;
  const hasIcon = Boolean(imageUrl?.trim());

  return (
    <Link href={home} className="flex items-center gap-2 font-bold text-lg shrink-0" aria-label={brand}>
      {hasIcon ? (
        <Image
          src={imageUrl.trim()}
          alt={alt}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg object-contain"
          unoptimized
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
          {brand.charAt(0).toUpperCase()}
        </div>
      )}
      {showBrandName !== false && <span>{brand}</span>}
    </Link>
  );
}

export type { NavLinkItem, NavMenuItem };
