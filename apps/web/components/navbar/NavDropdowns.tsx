'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeaderContent, NavLinkItem, NavMenuItem } from '@hellodownloader/shared-types';

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
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-border bg-card py-1 shadow-xl">
          {children.map((child) => (
            <Link
              key={`${child.label}-${child.href}`}
              href={child.href}
              onClick={() => setOpen(false)}
              className={cn(
                'block px-4 py-2.5 text-sm transition-colors hover:bg-accent',
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
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        <span className="max-w-[120px] truncate hidden sm:inline">{userLabel ?? accountLabel}</span>
        <span className="sm:hidden">{accountLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-border bg-card py-1 shadow-xl">
          <Link
            href={dashboardLink}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {dashboardText}
          </Link>
          {isAdmin && (
            <Link
              href={adminLink}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-primary hover:bg-accent"
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
            className="block w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
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
  compactBrandOnMobile = false,
}: {
  imageUrl: string;
  imageAlt: string;
  text: string;
  link: string;
  showBrandName: boolean;
  compactBrandOnMobile?: boolean;
}) {
  const brand = text?.trim() || 'HelloDownloader';
  const home = link?.trim() || '/';
  const alt = imageAlt?.trim() || brand;
  const hasIcon = Boolean(imageUrl?.trim());

  return (
    <Link href={home} className="flex items-center gap-2 font-bold text-lg shrink-0 min-w-0" aria-label={brand}>
      {hasIcon ? (
        <Image
          src={imageUrl.trim()}
          alt={alt}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg object-contain shrink-0"
          unoptimized
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
          {brand.charAt(0).toUpperCase()}
        </div>
      )}
      {showBrandName !== false && (
        <span className={cn('truncate', compactBrandOnMobile && 'hidden sm:inline')}>{brand}</span>
      )}
    </Link>
  );
}

function MobileNavSection({
  item,
  pathname,
  onNavigate,
}: {
  item: NavMenuItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const children = (item.children ?? []).filter((c) => c.label?.trim() && c.href?.trim());
  const [expanded, setExpanded] = useState(false);

  if (children.length === 0) {
    const active = pathname === item.href;
    return (
      <Link
        href={item.href ?? '#'}
        onClick={onNavigate}
        className={cn(
          'block rounded-lg px-3 py-2.5 text-sm transition-colors',
          active
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {item.label}
      </Link>
    );
  }

  const isActive = children.some(
    (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
  );

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        {item.label}
        <ChevronDown className={cn('h-4 w-4 opacity-60 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="ml-2 space-y-0.5 border-l border-border pl-2">
          {children.map((child) => (
            <Link
              key={`${child.label}-${child.href}`}
              href={child.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === child.href
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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

type MobileNavUser = {
  name?: string | null;
  email: string;
  plan?: string;
  role?: string;
};

export function MobileNavMenu({
  open,
  onClose,
  menu,
  pathname,
  auth,
  user,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  menu: NavMenuItem[];
  pathname: string;
  auth: HeaderContent['auth'];
  user: MobileNavUser | null;
  onLogout: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const userLabel = user?.name ?? user?.email.split('@')[0];

  return createPortal(
    <div className="lg:hidden">
      <button
        type="button"
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <nav
        className="fixed inset-y-0 right-0 z-[201] flex w-full max-w-[320px] flex-col border-l border-border bg-background shadow-2xl"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Menu</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
          {menu.map((item, i) => (
            <MobileNavSection
              key={`mobile-${item.label}-${i}`}
              item={item}
              pathname={pathname}
              onNavigate={onClose}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-border p-4 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {user ? (
            <>
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-sm font-medium truncate">{userLabel}</p>
                {user.plan === 'PRO' && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-primary font-medium">
                    <Zap className="h-3 w-3" /> Pro
                  </p>
                )}
              </div>
              <Link
                href={auth.dashboardLink}
                onClick={onClose}
                className="block rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {auth.dashboardText}
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  href={auth.adminLink}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2.5 text-sm text-primary hover:bg-accent"
                >
                  {auth.adminText}
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {auth.logoutText}
              </button>
            </>
          ) : (
            <>
              <Link href={auth.loginLink} onClick={onClose} className="block">
                <Button variant="outline" className="w-full">
                  {auth.loginText}
                </Button>
              </Link>
              <Link href={auth.signupLink} onClick={onClose} className="block">
                <Button className="w-full font-semibold">{auth.signupText}</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>,
    document.body,
  );
}

export type { NavLinkItem, NavMenuItem };
