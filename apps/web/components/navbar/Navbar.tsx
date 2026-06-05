'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { ChevronDown, Download, Moon, Sun, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/download', label: 'Downloads' },
  { href: '/thumbnail', label: 'Tools' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useUserStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0e14]/90 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Download className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>HelloDownloader</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === l.href
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
              {(l.label === 'Downloads' || l.label === 'Tools') && (
                <ChevronDown className="h-3 w-3 opacity-50" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
                <span className="hidden sm:flex items-center gap-1 text-xs text-primary font-medium">
                  <Zap className="h-3 w-3" /> Pro
                </span>
              )}
              <span className="hidden sm:inline text-xs text-muted-foreground">
                {user.credits ?? 0} credits
              </span>
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-white/10">
                  Dashboard
                </Button>
              </Link>
              {user.role === 'ADMIN' && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="border-primary/40 text-primary">
                    Admin
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-lg font-semibold">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
