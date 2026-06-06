'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, StatCard } from '@/components/admin/AdminShell';

type Analytics = {
  downloadsByType: Record<string, number>;
  downloadsByStatus: Record<string, number>;
  usersByPlan: Record<string, number>;
  topEvents: { event: string; count: number }[];
  downloadsPerDay: { date: string; count: number }[];
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    apiClient.admin.analytics().then((d) => setData(d as Analytics));
  }, []);

  const maxDay = Math.max(...(data?.downloadsPerDay.map((d) => d.count) ?? [1]), 1);

  return (
    <>
      <AdminPageHeader title="Analytics" description="Usage trends and breakdowns" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {data &&
          Object.entries(data.usersByPlan).map(([plan, count]) => (
            <StatCard key={plan} label={`Users (${plan})`} value={count} />
          ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Downloads by type</h2>
          <ul className="space-y-2 text-sm">
            {data &&
              Object.entries(data.downloadsByType).map(([type, count]) => (
                <li key={type} className="flex justify-between">
                  <span>{type}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Downloads by status</h2>
          <ul className="space-y-2 text-sm">
            {data &&
              Object.entries(data.downloadsByStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{status}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4 mb-8">
        <h2 className="font-semibold mb-4">Downloads last 7 days</h2>
        <div className="flex items-end gap-2 h-32">
          {data?.downloadsPerDay.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/80 rounded-t min-h-[4px]"
                style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                title={`${d.count} downloads`}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {data?.topEvents.length ? (
        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Top events</h2>
          <ul className="space-y-2 text-sm">
            {data.topEvents.map((e) => (
              <li key={e.event} className="flex justify-between">
                <span>{e.event}</span>
                <span>{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
