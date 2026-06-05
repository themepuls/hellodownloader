'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  BarChart3,
  Coins,
  Download,
  FileText,
  HardDrive,
  Image,
  KeyRound,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/userStore';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/downloads', label: 'Downloads', icon: Download },
  { href: '/admin/payments', label: 'Payments', icon: Wallet },
  { href: '/admin/thumbnails', label: 'Thumbnails', icon: Image },
  { href: '/admin/api-settings', label: 'API Settings', icon: KeyRound },
  { href: '/admin/credits', label: 'Credits', icon: Coins },
  { href: '/admin/storage', label: 'Storage', icon: HardDrive },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, router]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Please log in as admin.
      </div>
    );
  }

  if (user.role !== 'ADMIN') return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/10 bg-[#0b0e14]/50 p-4 gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2 font-semibold text-primary">
          <Shield className="h-5 w-5" />
          Admin
        </div>
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
        <div className="mt-auto pt-4 border-t border-white/10">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="w-full border-white/10">
              User dashboard
            </Button>
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
    </div>
  );
}

export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'COMPLETED' || status === 'ACTIVE'
      ? 'bg-emerald-500/15 text-emerald-400'
      : status === 'FAILED' || status === 'CANCELLED'
        ? 'bg-red-500/15 text-red-400'
        : status === 'PROCESSING' || status === 'QUEUED'
          ? 'bg-amber-500/15 text-amber-400'
          : 'bg-white/10 text-muted-foreground';
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', tone)}>
      {status}
    </span>
  );
}

export function PaginationBar({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
