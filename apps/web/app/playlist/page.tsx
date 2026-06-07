'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UrlInput } from '@/components/downloader/UrlInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ToolPageAdsBottom,
  ToolPageAdsTop,
  ToolPageWithSidebar,
} from '@/components/ads/ToolPageAds';
import { apiClient } from '@/lib/api';
import { AnalyzingPanel } from '@/components/downloader/AnalyzingPanel';
import { JobStatusPanel } from '@/components/downloader/JobStatusPanel';
import { AuthDivider, GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { isGoogleAuthConfigured } from '@/components/providers/GoogleAuthProvider';
import { saveCompletedFile } from '@/lib/save-file';
import { useAffiliateOnSave } from '@/hooks/useAffiliateOnSave';
import { useUserStore } from '@/store/userStore';
import Link from 'next/link';

type PlaylistStatus = {
  id: string;
  status: string;
  progress: number;
  itemCount?: number;
  error?: string | null;
};

function estimateVideosDone(progress: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total, Math.max(0, Math.floor(((progress - 10) / 75) * total)));
}

export default function PlaylistPage() {
  const user = useUserStore((s) => s.user);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlaylistStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const openAffiliate = useAffiliateOnSave('playlist');

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (id: string) => {
      stopPolling();
      void (async () => {
        try {
          const next = (await apiClient.playlists.status(id)) as PlaylistStatus;
          setStatus(next);
          if (next.status === 'COMPLETED' || next.status === 'FAILED') {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      })();
      pollRef.current = setInterval(async () => {
        try {
          const next = (await apiClient.playlists.status(id)) as PlaylistStatus;
          setStatus(next);
          if (next.status === 'COMPLETED' || next.status === 'FAILED') {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, 2000);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleCancel = useCallback(() => {
    createAbortRef.current?.abort();
    createAbortRef.current = null;
    stopPolling();
    setStatus(null);
    setPlaylistId(null);
    setLoading(false);
    setError(null);
  }, [stopPolling]);

  const handleCancelStart = useCallback(() => {
    createAbortRef.current?.abort();
    createAbortRef.current = null;
    setLoading(false);
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    createAbortRef.current?.abort();
    const controller = new AbortController();
    createAbortRef.current = controller;

    setLoading(true);
    setError(null);
    setStatus(null);
    setPlaylistId(null);
    try {
      const result = (await apiClient.playlists.create({ url }, controller.signal)) as { id: string };
      if (controller.signal.aborted) return;
      setPlaylistId(result.id);
      pollStatus(result.id);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to start playlist download');
    } finally {
      if (createAbortRef.current === controller) {
        createAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const saveZip = async () => {
    if (!playlistId) return;
    openAffiliate();
    setSaving(true);
    setError(null);
    try {
      await saveCompletedFile(`/playlists/${playlistId}/file`, `playlist-${playlistId}.zip`, {
        auth: true,
        fileExtension: '.zip',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save ZIP');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <>
        <ToolPageAdsTop page="playlist" />
        <ToolPageWithSidebar page="playlist">
          <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center sm:py-16">
            <Card className="w-full">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Playlist Downloader</CardTitle>
                <CardDescription className="text-base">
                  Free — up to 720p. Sign in to export a full playlist as ZIP.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3 pb-8">
                {isGoogleAuthConfigured() && (
                  <>
                    <GoogleSignInButton mode="login" redirectTo="/playlist" className="w-full" />
                    <AuthDivider />
                  </>
                )}
                <Link href="/login" className="w-full">
                  <Button variant={isGoogleAuthConfigured() ? 'outline' : 'default'} className="w-full">
                    Sign in with email
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground">
                  No account?{' '}
                  <Link href="/register" className="text-primary underline underline-offset-2">
                    Register
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </ToolPageWithSidebar>
        <ToolPageAdsBottom page="playlist" />
      </>
    );
  }

  const isProcessing = status && ['QUEUED', 'PROCESSING', 'PENDING'].includes(status.status);
  const isComplete = status?.status === 'COMPLETED';

  return (
    <>
      <ToolPageAdsTop page="playlist" />
      <ToolPageWithSidebar page="playlist">
        <div>
          <h1 className="text-3xl font-bold mb-2">Playlist Downloader</h1>
          <p className="text-muted-foreground mb-2">
            Free for all users — downloads up to 720p and packs videos into one ZIP.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Pro unlocks 1080p–4K playlist quality and AI thumbnail tools.
          </p>

          <Card>
            <CardHeader><CardTitle>Playlist URL</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <UrlInput
                value={url}
                onChange={setUrl}
                placeholder="https://www.youtube.com/playlist?list=..."
              />
              <p className="text-xs text-muted-foreground">
                Example: https://www.youtube.com/playlist?list=PLxxxxxx
              </p>
              <Button onClick={handleSubmit} disabled={!url || loading || !!isProcessing} className="w-full">
                {loading ? 'Starting…' : 'Export ZIP (free)'}
              </Button>

              {loading && !status && (
                <AnalyzingPanel
                  title="Starting playlist export…"
                  subtitle="Creating your playlist job on the server."
                  onCancel={handleCancelStart}
                />
              )}

              {error && !status && (
                <JobStatusPanel status="FAILED" error={error} />
              )}

              {status && (
                <JobStatusPanel
                  status={status.status as 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'}
                  progress={Math.max(status.progress, 10)}
                  error={status.status === 'FAILED' ? status.error ?? 'Download failed' : undefined}
                  warning={isComplete ? status.error : undefined}
                  processingDetail={
                    isProcessing ? (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {status.itemCount
                            ? `Video ${estimateVideosDone(status.progress, status.itemCount)} of ${status.itemCount}`
                            : 'Preparing playlist…'}
                        </span>
                        <span>{Math.max(status.progress, 10)}%</span>
                      </div>
                    ) : undefined
                  }
                  processingHint="Large playlists can take 30+ minutes. Keep this tab open."
                  onCancel={isProcessing ? handleCancel : undefined}
                >
                  {isComplete && (
                    <div className="space-y-3 border-t border-border pt-3">
                      {error && <p className="text-sm text-red-700 dark:text-red-200">{error}</p>}
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        {status.itemCount ?? 'All'} video(s) packed in ZIP
                      </p>
                      <Button onClick={saveZip} disabled={saving} className="w-full">
                        {saving ? 'Saving…' : 'Save ZIP to your computer'}
                      </Button>
                    </div>
                  )}
                </JobStatusPanel>
              )}
            </CardContent>
          </Card>
        </div>
      </ToolPageWithSidebar>
      <ToolPageAdsBottom page="playlist" />
    </>
  );
}
