'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, PaginationBar, StatusBadge } from '@/components/admin/AdminShell';

type Row = {
  id: string;
  videoUrl: string;
  ratio: string;
  status: string;
  creditsUsed: number;
  error: string | null;
  user: { email: string };
  ocrData: { mode?: string; title?: string } | null;
  createdAt: string;
};

export default function AdminThumbnailsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; page: number; pages: number } | null>(null);

  const load = useCallback(() => {
    apiClient.admin.listThumbnails({ page }).then((d) => setData(d as typeof data));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <AdminPageHeader title="Thumbnails" description="Original and AI thumbnail jobs" />
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-muted-foreground">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Ratio</th>
              <th className="p-3">Credits</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((t) => (
              <tr key={t.id} className="border-t border-white/5">
                <td className="p-3 text-xs">{t.user.email}</td>
                <td className="p-3">{t.ocrData?.mode ?? 'ai'}</td>
                <td className="p-3">{t.ratio}</td>
                <td className="p-3">{t.creditsUsed}</td>
                <td className="p-3">
                  <StatusBadge status={t.status} />
                  {t.error && <div className="text-xs text-red-400">{t.error}</div>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <PaginationBar page={data.page} pages={data.pages} onPage={setPage} />}
    </>
  );
}
