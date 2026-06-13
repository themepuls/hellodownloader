'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Image, ListMusic, Loader2 } from 'lucide-react';
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

type DashboardStats = {
  totalDownloads: number;
  totalVideos: number;
  totalPlaylists: number;
  totalThumbnails: number;
  credits: number;
  plan: string;
  historyDays?: number | null;
  videoRetentionHours?: number;
  thumbnailRetentionDays?: number;
  recentActivity: ActivityItem[];
  hiddenCount?: number;
  unavailableCount?: number;
  activityPage?: number;
  activityTotalPages?: number;
  activityTotal?: number;
};

const PAGE_SIZE = 10;

function formatRetentionHours(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function formatRetentionDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

export default function DashboardPage() {
  const user = useUserStore((s) => s.user);
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [page, setPage] = useState(1);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async (pageNum: number) => {
    setLoadingActivity(true);
    setLoadError(null);
    try {
      const d = (await apiClient.users.dashboard(pageNum, PAGE_SIZE)) as DashboardStats;
      setStats(d);
      if (d.activityPage && d.activityPage !== pageNum) {
        setPage(d.activityPage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setLoadError(message);
      console.error(err);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated || !user) return;
    void loadDashboard(page);
  }, [page, loadDashboard, hasHydrated, user]);

  const handleSaveAgain = async (item: ActivityItem) => {
    setSavingId(item.id);
    setSaveError(null);
    setSaveNotice(null);
    try {
      if (item.kind === 'PLAYLIST') {
        await saveCompletedFile(`/playlists/${item.id}/file`, `playlist-${item.id}.zip`, {
          auth: true,
          fileExtension: '.zip',
        });
      } else if (item.kind === 'VIDEO') {
        await saveCompletedFile(`/downloads/${item.id}/file`, item.title || `download-${item.id}`, {
          auth: true,
        });
      } else if (item.kind === 'THUMBNAIL') {
        await saveCompletedFile(`/thumbnails/${item.id}/file`, item.title || `thumbnail-${item.id}`, {
          auth: true,
          fileExtension: '.jpg',
        });
      }
      setSaveNotice('Download started — check your browser downloads.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setSaveError(message);
      if (message.includes('no longer on server') || message.includes('expired')) {
        void loadDashboard(page);
      }
    } finally {
      setSavingId(null);
    }
  };

  if (!hasHydrated) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p>
          Please{' '}
          <Link href="/login" className="text-primary underline">
            login
          </Link>{' '}
          to view dashboard.
        </p>
      </div>
    );
  }

  if (loadError?.includes('log in')) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="mb-4">Your session expired. Please sign in again.</p>
        <Link href="/login">
          <Button>Go to login</Button>
        </Link>
      </div>
    );
  }

  const kindLabel: Record<ActivityItem['kind'], string> = {
    VIDEO: 'Video',
    PLAYLIST: 'Playlist',
    THUMBNAIL: 'Thumbnail',
  };

  const totalPages = stats?.activityTotalPages ?? 1;
  const currentPage = stats?.activityPage ?? page;
  const hiddenCount = stats?.hiddenCount ?? stats?.unavailableCount ?? 0;
  const hasDownloadableList = (stats?.activityTotal ?? 0) > 0;
  const videoRetention = formatRetentionHours(stats?.videoRetentionHours ?? 1);
  const thumbnailRetention = formatRetentionDays(stats?.thumbnailRetentionDays ?? 30);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid md:grid-cols-3 gap-6 mb-8">
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
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalThumbnails ?? 0}</div>
          </CardContent>
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Recent Activity</CardTitle>
          <Link href="/download">
            <Button size="sm">New Download</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <p
            className={`text-sm rounded-lg px-3 py-2 mb-3 border ${
              hiddenCount > 0
                ? 'text-amber-800 dark:text-amber-200 bg-amber-500/10 border-amber-500/30'
                : 'text-muted-foreground bg-muted/40 border-border'
            }`}
          >
            Videos and playlists are available for {videoRetention} after completion, then they are
            removed. Thumbnails stay available for {thumbnailRetention}.
            {hiddenCount > 0 && (
              <>
                {' '}
                {hiddenCount} {hiddenCount === 1 ? 'item' : 'items'} (expired, failed, or no longer
                stored) {hiddenCount === 1 ? 'was' : 'were'} hidden from this list — start a new
                download from the same URL if you need the file again.
              </>
            )}
          </p>
          {saveError && <p className="text-sm text-destructive mb-3">{saveError}</p>}
          {saveNotice && (
            <p className="text-sm text-emerald-600 dark:text-green-400 mb-3">{saveNotice}</p>
          )}

          {loadingActivity ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : hasDownloadableList && stats?.recentActivity?.length ? (
            <>
              <ul className="space-y-3">
                {stats.recentActivity.map((item) => {
                  const canSaveAgain =
                    item.status === 'COMPLETED' &&
                    item.fileAvailable &&
                    (item.kind === 'VIDEO' || item.kind === 'PLAYLIST' || item.kind === 'THUMBNAIL');
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
                            variant="default"
                            className="gap-1.5"
                            disabled={isSaving}
                            onClick={() => void handleSaveAgain(item)}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            Download again
                          </Button>
                        ) : item.kind === 'THUMBNAIL' ? (
                          <Link href="/thumbnail">
                            <Button size="sm" variant="outline">
                              Open thumbnails
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-4 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                    {stats.activityTotal != null && ` · ${stats.activityTotal} available`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : hiddenCount === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : null}

          {stats?.historyDays != null && (
            <p className="text-xs text-muted-foreground mt-4">
              Activity history: last {stats.historyDays} days on Free, full history on Pro. Download
              again while files are still within the retention period above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
