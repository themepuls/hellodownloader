'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, PaginationBar, StatusBadge } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';

type DownloadRow = {
  id: string;
  title: string | null;
  url: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  fileAvailable: boolean;
  user: { email: string };
  createdAt: string;
};

type PlaylistRow = {
  id: string;
  title: string | null;
  status: string;
  progress: number;
  itemCount: number;
  fileAvailable: boolean;
  error: string | null;
  user: { email: string };
  createdAt: string;
};

export default function AdminDownloadsPage() {
  const [tab, setTab] = useState<'videos' | 'playlists'>('videos');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [downloads, setDownloads] = useState<{ items: DownloadRow[]; page: number; pages: number } | null>(null);
  const [playlists, setPlaylists] = useState<{ items: PlaylistRow[]; page: number; pages: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = { page, status: status || undefined };
    if (tab === 'videos') {
      apiClient.admin.listDownloads(params).then((d) => setDownloads(d as typeof downloads));
    } else {
      apiClient.admin.listPlaylists(params).then((d) => setPlaylists(d as typeof playlists));
    }
  }, [tab, page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      setMsg('Done');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Action failed');
    }
  };

  return (
    <>
      <AdminPageHeader title="Downloads" description="Monitor and manage download jobs" />
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={tab === 'videos' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('videos'); setPage(1); }}>
          Videos
        </Button>
        <Button variant={tab === 'playlists' ? 'default' : 'outline'} size="sm" onClick={() => { setTab('playlists'); setPage(1); }}>
          Playlists
        </Button>
        <select
          className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm ml-auto"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="PROCESSING">Processing</option>
          <option value="QUEUED">Queued</option>
        </select>
      </div>
      {msg && <p className="text-sm mb-2 text-muted-foreground">{msg}</p>}

      {tab === 'videos' && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">File</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {downloads?.items.map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className="p-3 max-w-[200px] truncate" title={d.title ?? d.url}>
                      {d.title ?? 'Untitled'}
                      {d.error && <div className="text-xs text-red-400 truncate">{d.error}</div>}
                    </td>
                    <td className="p-3 text-xs">{d.user.email}</td>
                    <td className="p-3">{d.type}</td>
                    <td className="p-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="p-3">{d.fileAvailable ? 'On server' : '—'}</td>
                    <td className="p-3 flex flex-wrap gap-1">
                      {d.status === 'FAILED' && (
                        <Button size="sm" variant="outline" onClick={() => action(() => apiClient.admin.retryDownload(d.id))}>
                          Retry
                        </Button>
                      )}
                      {(d.status === 'QUEUED' || d.status === 'PROCESSING') && (
                        <Button size="sm" variant="outline" onClick={() => action(() => apiClient.admin.cancelDownload(d.id))}>
                          Cancel
                        </Button>
                      )}
                      {d.fileAvailable && (
                        <Button size="sm" variant="outline" onClick={() => action(() => apiClient.admin.deleteDownloadFile(d.id))}>
                          Delete file
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {downloads && <PaginationBar page={downloads.page} pages={downloads.pages} onPage={setPage} />}
        </>
      )}

      {tab === 'playlists' && (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">ZIP</th>
                </tr>
              </thead>
              <tbody>
                {playlists?.items.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="p-3">{p.title ?? 'Playlist'}</td>
                    <td className="p-3 text-xs">{p.user.email}</td>
                    <td className="p-3">{p.itemCount}</td>
                    <td className="p-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-3">{p.fileAvailable ? 'On server' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {playlists && <PaginationBar page={playlists.page} pages={playlists.pages} onPage={setPage} />}
        </>
      )}
    </>
  );
}
