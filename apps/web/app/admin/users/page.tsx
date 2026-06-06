'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, PaginationBar, StatusBadge } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  credits: number;
  downloadCount: number;
  playlistCount: number;
  createdAt: string;
};

type ListRes = { items: UserRow[]; page: number; pages: number };

export default function AdminUsersPage() {
  const [data, setData] = useState<ListRes | null>(null);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [creditsDelta, setCreditsDelta] = useState('10');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient.admin
      .listUsers({ page, search: search || undefined, plan: plan || undefined })
      .then((d) => setData(d as ListRes))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Load failed'));
  }, [page, search, plan]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUser = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    setMsg(null);
    setErr(null);
    try {
      await apiClient.admin.updateUser(selected.id, patch);
      setMsg('User updated');
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const resetPassword = async () => {
    if (!selected || newPassword.length < 8) return;
    setErr(null);
    try {
      await apiClient.admin.resetPassword(selected.id, newPassword);
      setMsg('Password reset');
      setNewPassword('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  return (
    <>
      <AdminPageHeader title="Users" description="Manage accounts, plans, and credits" />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Search email or name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
        </select>
      </div>
      {err && <p className="text-destructive text-sm mb-2">{err}</p>}
      {msg && <p className="text-emerald-400 text-sm mb-2">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-accent/50 text-left text-muted-foreground">
            <tr>
              <th className="p-3">Email</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Role</th>
              <th className="p-3">Credits</th>
              <th className="p-3">Downloads</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-border/60 hover:bg-accent">
                <td className="p-3">
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.name ?? '—'}</div>
                </td>
                <td className="p-3">
                  <StatusBadge status={u.plan} />
                </td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.credits}</td>
                <td className="p-3">{u.downloadCount}</td>
                <td className="p-3">
                  <Button variant="outline" size="sm" onClick={() => setSelected(u)}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <PaginationBar page={data.page} pages={data.pages} onPage={setPage} />}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold text-lg">{selected.email}</h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => updateUser({ plan: 'PRO' })}>
                Set Pro
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateUser({ plan: 'FREE' })}>
                Set Free
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateUser({ role: 'ADMIN' })}>
                Make admin
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateUser({ role: 'USER' })}>
                Remove admin
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                value={creditsDelta}
                onChange={(e) => setCreditsDelta(e.target.value)}
                placeholder="Credits +/-"
              />
              <Button
                size="sm"
                onClick={() => updateUser({ creditsDelta: parseInt(creditsDelta, 10) || 0 })}
              >
                Adjust credits
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (8+ chars)"
              />
              <Button size="sm" variant="outline" onClick={resetPassword}>
                Reset
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
