'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Image, Coins, ListMusic, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { saveCompletedFile } from '@/lib/save-file';
import { useUserStore } from '@/store/userStore';

type ActivityItem = {
  id: string;
  kind: 'VIDEO' | 'PLAYLIST' | 'THUMBNAIL';
  title: string;
  status: string;
  progress: number;
  fileAvailable?: boolean;
};

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const [stats, setStats] = useState<{
    totalDownloads: number;
    totalVideos: number;
    totalPlaylists: number;
    totalThumbnails: number;
    credits: number;
    plan: string;
    historyDays?: number | null;
    recentActivity: ActivityItem[];
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.users.dashboard().then((d) => setStats(d as NonNullable<typeof stats>)).catch(console.error);
  }, []);

  const handleSaveAgain = async (item: ActivityItem) => {
    setSavingId(item.id);
    setSaveError(null);
    try {
      if (item.kind === 'PLAYLIST') {
        await saveCompletedFile(`/playlists/${item.id}/file`, `playlist-${item.id}.zip`, true);
      } else if (item.kind === 'VIDEO') {
        await saveCompletedFile(`/downloads/${item.id}/file`, item.title || `download-${item.id}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p>Please <Link href="/login" className="text-primary underline">login</Link> to view dashboard.</p>
      </div>
    );
  }

  const kindLabel: Record<ActivityItem['kind'], string> = {
    VIDEO: 'Video',
    PLAYLIST: 'Playlist',
    THUMBNAIL: 'Thumbnail',
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDownloads ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalVideos ?? 0} videos · {stats?.totalPlaylists ?? 0} playlists
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Thumbnails</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.totalThumbnails ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.credits ?? user.credits}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <ListMusic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.plan ?? user.plan}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link href="/download"><Button size="sm">New Download</Button></Link>
        </CardHeader>
        <CardContent>
          {saveError && <p className="text-sm text-destructive mb-3">{saveError}</p>}
          {stats?.recentActivity?.length ? (
            <ul className="space-y-3">
              {stats.recentActivity.map((item) => {
                const canSaveAgain =
                  item.status === 'COMPLETED' &&
                  item.fileAvailable &&
                  (item.kind === 'VIDEO' || item.kind === 'PLAYLIST');
                const isSaving = savingId === item.id;

                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="text-xs uppercase tracking-wide text-primary mr-2">
                        {kindLabel[item.kind]}
                      </span>
                      <span className="truncate">{item.title}</span>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {item.status} · {item.progress}%
                      </p>
                    </div>
                    <div className="shrink-0">
                      {canSaveAgain ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={isSaving}
                          onClick={() => void handleSaveAgain(item)}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Save again
                        </Button>
                      ) : item.status === 'COMPLETED' && !item.fileAvailable ? (
                        <span className="text-xs text-muted-foreground">Saved · file removed from server</span>
                      ) : item.kind === 'THUMBNAIL' ? (
                        <Link href="/thumbnail">
                          <Button size="sm" variant="outline">Open thumbnails</Button>
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          )}
          {stats?.historyDays != null && (
            <p className="text-xs text-muted-foreground mt-4">
              Free plan shows activity from the last {stats.historyDays} days. Pro keeps full history.
              Files are removed from the server right after you save them, or after 1 hour if you never download.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
