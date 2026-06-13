'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Moon, Sun, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';
import { usePageContent } from '@/hooks/usePageContent';
import {
  DEFAULT_HEADER_CONTENT,
  filterRemovedNavLinks,
  mergeContent,
  type HeaderContent,
} from '@hellodownloader/shared-types';
import {
  AccountDropdown,
  HeaderLogo,
  MobileNavMenu,
  NavMenuDropdown,
} from './NavDropdowns';

function normalizeHeader(raw: HeaderContent): HeaderContent {
  const base = mergeContent(DEFAULT_HEADER_CONTENT, raw as unknown as Record<string, unknown>);
  return {
    ...base,
    logo: { ...DEFAULT_HEADER_CONTENT.logo, ...base.logo },
    auth: { ...DEFAULT_HEADER_CONTENT.auth, ...base.auth },
    menu: filterRemovedNavLinks(
      (base.menu ?? []).map((item) => {
        const children = (item.children ?? []).filter((c) => c.label?.trim() && c.href?.trim());
        if (children.length > 0) {
          return { label: item.label, children, href: undefined };
        }
        return { label: item.label, href: item.href || '/', children: undefined };
      }),
    ),
  };
}

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useUserStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rawHeader = usePageContent(
    'header',
    DEFAULT_HEADER_CONTENT as unknown as Record<string, unknown>,
  );
  const header = normalizeHeader(rawHeader as unknown as HeaderContent);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const { logo, menu, auth } = header;
  // Avoid hydration mismatch: persisted auth is client-only until mount.
  const sessionUser = mounted ? user : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center">
            <HeaderLogo
              imageUrl={logo.imageUrl}
              imageAlt={logo.imageAlt ?? ''}
              text={logo.text}
              link={logo.link}
              showBrandName={logo.showBrandName !== false}
              compactBrandOnMobile
            />
          </div>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {menu.map((item, i) => (
              <NavMenuDropdown key={`${item.label}-${i}`} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted ? (
                theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </Button>

            <div className="hidden items-center gap-2 lg:flex">
              {sessionUser ? (
                <>
                  {sessionUser.plan === 'PRO' && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Zap className="h-3 w-3" /> Pro
                    </span>
                  )}
                  <AccountDropdown
                    accountLabel={auth.accountLabel}
                    dashboardText={auth.dashboardText}
                    dashboardLink={auth.dashboardLink}
                    adminText={auth.adminText}
                    adminLink={auth.adminLink}
                    logoutText={auth.logoutText}
                    isAdmin={sessionUser.role === 'ADMIN'}
                    onLogout={logout}
                    userLabel={sessionUser.name ?? sessionUser.email.split('@')[0]}
                  />
                </>
              ) : (
                <>
                  <Link href={auth.loginLink}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      {auth.loginText}
                    </Button>
                  </Link>
                  <Link href={auth.signupLink}>
                    <Button size="sm" className="rounded-lg font-semibold">
                      {auth.signupText}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <MobileNavMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        menu={menu}
        pathname={pathname}
        auth={auth}
        user={sessionUser}
        onLogout={logout}
      />
    </>
  );
}
