'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, StatCard } from '@/components/admin/AdminShell';

type Overview = {
  users: number;
  newUsersToday: number;
  downloads: number;
  downloadsToday: number;
  failedToday: number;
  playlists: number;
  thumbnails: number;
  proUsers: number;
  activeSubscriptions: number;
  revenue: number;
  revenueWeek: number;
  failedDownloadsWeek: number;
  guestDownloads: number;
  storage: { totalMb: number; totalFiles: number };
  fourKInterest?: { yes: number; no: number; total: number };
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.admin
      .stats()
      .then((d) => setData(d as Overview))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Overview" description="Platform stats at a glance" />
      {error && <p className="text-destructive mb-4">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total users" value={data?.users ?? '—'} sub={`+${data?.newUsersToday ?? 0} today`} />
        <StatCard label="Downloads today" value={data?.downloadsToday ?? '—'} sub={`${data?.failedToday ?? 0} failed today`} />
        <StatCard label="Pro users" value={data?.proUsers ?? '—'} sub={`${data?.activeSubscriptions ?? 0} active subs`} />
        <StatCard
          label="Revenue"
          value={data ? `$${data.revenue.toFixed(2)}` : '—'}
          sub={data ? `$${data.revenueWeek.toFixed(2)} this week` : undefined}
        />
      </div>
      <div className="rounded-xl border border-border bg-card/50 p-5 mb-8">
        <h2 className="text-sm font-semibold mb-1">4K download interest survey</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Responses from logged-in users and guests on the download page.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <StatCard label="Yes — need 4K" value={data?.fourKInterest?.yes ?? '—'} />
          <StatCard label="No — not needed" value={data?.fourKInterest?.no ?? '—'} />
          <StatCard label="Total responses" value={data?.fourKInterest?.total ?? '—'} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total downloads" value={data?.downloads ?? '—'} />
        <StatCard label="Playlists" value={data?.playlists ?? '—'} />
        <StatCard label="Thumbnails" value={data?.thumbnails ?? '—'} />
        <StatCard
          label="Storage"
          value={data ? `${data.storage.totalMb} MB` : '—'}
          sub={data ? `${data.storage.totalFiles} files on disk` : undefined}
        />
        <StatCard label="Guest downloads" value={data?.guestDownloads ?? '—'} sub="Not tied to logged-in users" />
        <StatCard label="Failed (7d)" value={data?.failedDownloadsWeek ?? '—'} />
      </div>
    </>
  );
}
