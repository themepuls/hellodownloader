'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, StatCard } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Storage = {
  basePath: string;
  totalMb: number;
  totalFiles: number;
  retentionHours: number;
  breakdown: Record<string, { files: number; bytes: number }>;
};

type System = {
  nodeVersion: string;
  redisEnabled: boolean;
  redisConnected: boolean;
  inlineDownloads: boolean;
  fileRetentionHours: number;
  deleteAfterDownload: boolean;
  uptimeSeconds: number;
};

export default function AdminStoragePage() {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [system, setSystem] = useState<System | null>(null);
  const [hours, setHours] = useState('1');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    apiClient.admin.storage().then((d) => setStorage(d as Storage));
    apiClient.admin.system().then((d) => setSystem(d as System));
  };

  useEffect(() => {
    load();
  }, []);

  const runCleanup = async () => {
    setMsg(null);
    try {
      const res = (await apiClient.admin.cleanup(parseInt(hours, 10) || 1)) as { removed: number };
      setMsg(`Removed ${res.removed} files`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Cleanup failed');
    }
  };

  return (
    <>
      <AdminPageHeader title="Storage & system" description="Disk usage and server health" />
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total storage" value={storage ? `${storage.totalMb} MB` : '—'} sub={`${storage?.totalFiles ?? 0} files`} />
        <StatCard label="Retention" value={storage ? `${storage.retentionHours}h` : '—'} />
        <StatCard label="Uptime" value={system ? `${Math.floor(system.uptimeSeconds / 3600)}h` : '—'} />
      </div>

      {storage && (
        <div className="rounded-xl border border-white/10 p-4 mb-8">
          <h2 className="font-semibold mb-3">Breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {Object.entries(storage.breakdown).map(([dir, s]) => (
              <div key={dir} className="rounded-lg bg-white/5 p-3">
                <div className="font-medium capitalize">{dir}</div>
                <div className="text-muted-foreground text-xs">
                  {s.files} files · {(s.bytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Path: {storage.basePath}</p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 p-4 mb-8">
        <h2 className="font-semibold mb-3">Run cleanup now</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Delete files older than retention period from downloads, playlists, and temp folders.
        </p>
        <div className="flex gap-2 max-w-xs">
          <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          <Button onClick={runCleanup}>Cleanup</Button>
        </div>
        {msg && <p className="text-sm mt-2 text-muted-foreground">{msg}</p>}
      </div>

      {system && (
        <div className="rounded-xl border border-white/10 p-4 text-sm space-y-2">
          <h2 className="font-semibold mb-2">System</h2>
          <p>Node: {system.nodeVersion}</p>
          <p>Redis queue: {system.redisEnabled ? (system.redisConnected ? 'Connected' : 'Disabled/fallback') : 'Off (inline mode)'}</p>
          <p>Inline downloads: {system.inlineDownloads ? 'Yes' : 'No'}</p>
          <p>Delete after save: {system.deleteAfterDownload ? 'Yes' : 'No'}</p>
        </div>
      )}
    </>
  );
}
