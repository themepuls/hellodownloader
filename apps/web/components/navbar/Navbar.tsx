'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';
import { usePageContent } from '@/hooks/usePageContent';
import {
  DEFAULT_HEADER_CONTENT,
  mergeContent,
  type HeaderContent,
} from '@hellodownloader/shared-types';
import { AccountDropdown, HeaderLogo, NavMenuDropdown } from './NavDropdowns';

function normalizeHeader(raw: HeaderContent): HeaderContent {
  const base = mergeContent(DEFAULT_HEADER_CONTENT, raw as unknown as Record<string, unknown>);
  return {
    ...base,
    logo: { ...DEFAULT_HEADER_CONTENT.logo, ...base.logo },
    auth: { ...DEFAULT_HEADER_CONTENT.auth, ...base.auth },
    menu: (base.menu ?? []).map((item) => {
      const children = (item.children ?? []).filter((c) => c.label?.trim() && c.href?.trim());
      if (children.length > 0) {
        return { label: item.label, children, href: undefined };
      }
      return { label: item.label, href: item.href || '/', children: undefined };
    }),
  };
}

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useUserStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const rawHeader = usePageContent(
    'header',
    DEFAULT_HEADER_CONTENT as unknown as Record<string, unknown>,
  );
  const header = normalizeHeader(rawHeader as unknown as HeaderContent);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { logo, menu, auth } = header;

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0e14]/90 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <HeaderLogo
          imageUrl={logo.imageUrl}
          imageAlt={logo.imageAlt ?? ''}
          text={logo.text}
          link={logo.link}
          showBrandName={logo.showBrandName !== false}
        />

        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {menu.map((item, i) => (
            <NavMenuDropdown key={`${item.label}-${i}`} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <span className="inline-block h-4 w-4" aria-hidden />
            )}
          </Button>

          {user ? (
            <>
              {user.plan === 'PRO' && (
                <span className="hidden md:flex items-center gap-1 text-xs text-primary font-medium">
                  <Zap className="h-3 w-3" /> Pro
                </span>
              )}
              <span className="hidden md:inline text-xs text-muted-foreground">
                {user.credits ?? 0} credits
              </span>
              <AccountDropdown
                accountLabel={auth.accountLabel}
                dashboardText={auth.dashboardText}
                dashboardLink={auth.dashboardLink}
                adminText={auth.adminText}
                adminLink={auth.adminLink}
                logoutText={auth.logoutText}
                isAdmin={user.role === 'ADMIN'}
                onLogout={logout}
                userLabel={user.name ?? user.email.split('@')[0]}
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
      </div>

      <nav className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-2 border-t border-white/5 pt-2 scrollbar-none">
        {menu.map((item, i) => (
          <NavMenuDropdown key={`m-${item.label}-${i}`} item={item} pathname={pathname} />
        ))}
      </nav>
    </header>
  );
}
