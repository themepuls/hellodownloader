'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UrlInput } from '@/components/downloader/UrlInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { saveCompletedFile } from '@/lib/save-file';
import { useUserStore } from '@/store/userStore';
import Link from 'next/link';

type PlaylistStatus = {
  id: string;
  status: string;
  progress: number;
  itemCount?: number;
  error?: string | null;
};

const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1')
    : 'http://localhost:4000/api/v1';

export default function PlaylistPage() {
  const user = useUserStore((s) => s.user);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlaylistStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (id: string) => {
      stopPolling();
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

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    setPlaylistId(null);
    try {
      const result = (await apiClient.playlists.create({ url })) as { id: string };
      setPlaylistId(result.id);
      pollStatus(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start playlist download');
    } finally {
      setLoading(false);
    }
  };

  const saveZip = async () => {
    if (!playlistId) return;
    setSaving(true);
    setError(null);
    try {
      await saveCompletedFile(`/playlists/${playlistId}/file`, `playlist-${playlistId}.zip`, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save ZIP');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Playlist Downloader</h1>
        <p className="text-muted-foreground mb-6">
          Free — up to 720p. Sign in to export a full playlist as ZIP.
        </p>
        <Link href="/login"><Button>Sign in</Button></Link>
      </div>
    );
  }

  const isProcessing = status && ['QUEUED', 'PROCESSING', 'PENDING'].includes(status.status);
  const isComplete = status?.status === 'COMPLETED';

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Playlist Downloader</h1>
      <p className="text-muted-foreground mb-2">
        Free for all users — downloads up to 720p and packs videos into one ZIP.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          {status && (
            <div className="rounded-xl border border-white/10 bg-[#0b0e14] p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{status.status.toLowerCase()}</span>
              </div>
              {isProcessing && (
                <>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(status.progress, 10)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Downloading all videos on the server — large playlists can take a long time.
                  </p>
                </>
              )}
              {status.status === 'FAILED' && (
                <p className="text-sm text-red-400">{status.error ?? 'Download failed'}</p>
              )}
              {isComplete && (
                <>
                  <p className="text-sm text-green-400">
                    Ready — {status.itemCount ?? 'All'} video(s) in ZIP.
                  </p>
                  <Button onClick={saveZip} disabled={saving} className="w-full">
                    {saving ? 'Saving…' : 'Save ZIP to your computer'}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
