'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, PaginationBar } from '@/components/admin/AdminShell';

type Row = {
  id: string;
  amount: number;
  reason: string;
  balance: number;
  user: { email: string };
  createdAt: string;
};

export default function AdminCreditsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; page: number; pages: number } | null>(null);

  const load = useCallback(() => {
    apiClient.admin.listCredits({ page }).then((d) => setData(d as typeof data));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <AdminPageHeader title="Credits" description="Credit ledger across all users" />
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-muted-foreground">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Change</th>
              <th className="p-3">Balance after</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="p-3 text-xs">{c.user.email}</td>
                <td className={`p-3 font-medium ${c.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {c.amount >= 0 ? '+' : ''}
                  {c.amount}
                </td>
                <td className="p-3">{c.balance}</td>
                <td className="p-3 text-muted-foreground">{c.reason}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
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
