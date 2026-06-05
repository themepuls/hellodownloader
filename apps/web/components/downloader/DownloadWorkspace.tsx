'use client';

import { useEffect, useRef, useState } from 'react';
import { getThumbnailSrc } from '@/lib/thumbnail';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle2,
  Crown,
  Download,
  Headphones,
  HelpCircle,
  Music,
  Subtitles,
  Video,
} from 'lucide-react';
import { VideoUrlBar } from '@/components/downloader/VideoUrlBar';
import { Button } from '@/components/ui/button';
import { useDownloader } from '@/hooks/useDownloader';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import {
  formatDuration,
  formatFileSize,
  getMaxQuality,
  getVideoQualityOptions,
  type VideoMetadata,
} from '@/lib/video-formats';
import {
  DEFAULT_DOWNLOAD_CONTENT,
  type DownloadPageContent,
} from '@hellodownloader/shared-types';

type Tab = 'video' | 'audio' | 'subtitles';

const statusLabel: Record<string, string> = {
  QUEUED: 'Starting…',
  PROCESSING: 'Downloading…',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
};

interface DownloadWorkspaceProps {
  initialUrl?: string;
  autoAnalyze?: boolean;
  content?: DownloadPageContent;
}

export function DownloadWorkspace({
  initialUrl = '',
  autoAnalyze = false,
  content: contentProp,
}: DownloadWorkspaceProps) {
  const content = { ...DEFAULT_DOWNLOAD_CONTENT, ...contentProp };
  const user = useUserStore((s) => s.user);
  const maxQuality = user?.plan === 'PRO' ? 4320 : 720;
  const [tab, setTab] = useState<Tab>('video');
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const autoAnalyzed = useRef(false);

  const {
    url,
    setUrl,
    metadata,
    loading,
    error,
    download,
    fetchMetadata,
    startDownload,
    saveToPc,
    refreshStatus,
  } = useDownloader(initialUrl);

  useEffect(() => {
    if (autoAnalyze && initialUrl && !autoAnalyzed.current) {
      autoAnalyzed.current = true;
      setThumbnailFailed(false);
      void fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze, initialUrl]);

  const meta = metadata as VideoMetadata | null;

  useEffect(() => {
    setThumbnailFailed(false);
  }, [meta?.id, meta?.thumbnail]);
  const qualities = meta
    ? getVideoQualityOptions(meta.formats, 4320, meta.duration)
    : [];
  const isPro = user?.plan === 'PRO';
  const maxAvail = meta ? getMaxQuality(meta.formats) : 0;

  const handleAnalyze = () => {
    setThumbnailFailed(false);
    void fetchMetadata();
  };

  const handleQualityDownload = (height: number, formatId: string) => {
    void startDownload('VIDEO', height, formatId);
  };

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <div className="border-b border-white/5 bg-[#0d1017]/80 px-4 py-8">
        <div className="container mx-auto max-w-5xl">
          <VideoUrlBar
            value={url}
            onChange={setUrl}
            onSubmit={handleAnalyze}
            loading={loading && !metadata}
            variant="compact"
            submitLabel={content.analyzeButton}
          />
          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
          {meta && !error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {content.successText}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-8">
        {!meta && !loading && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#12151c]/50 py-24 text-center">
            <Video className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">{content.emptyTitle}</h2>
            <p className="text-muted-foreground">{content.emptySubtitle}</p>
          </div>
        )}

        {loading && !meta && (
          <div className="rounded-2xl border border-white/10 bg-[#12151c] py-24 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">{content.loadingText}</p>
          </div>
        )}

        {meta && (
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#12151c]">
                <div className="relative aspect-video bg-black">
                  {meta.thumbnail && !thumbnailFailed ? (
                    <Image
                      src={getThumbnailSrc(meta.thumbnail)}
                      alt={meta.title}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={() => setThumbnailFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Video className="h-12 w-12 opacity-40" />
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-0.5 text-xs font-medium">
                    {formatDuration(meta.duration)}
                  </div>
                </div>
                <div className="p-5">
                  <h1 className="mb-3 text-lg font-bold leading-snug">{meta.title}</h1>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30 text-xs font-bold">
                      {meta.uploader?.[0] ?? '?'}
                    </div>
                    <span className="text-sm font-medium">{meta.uploader}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Duration: {formatDuration(meta.duration)}</span>
                    {maxAvail > 0 && <span>Max: {maxAvail}p</span>}
                  </div>
                  {meta.thumbnail && !thumbnailFailed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full gap-2"
                      onClick={async () => {
                        if (url.trim()) {
                          try {
                            await apiClient.thumbnails.saveOriginal(url.trim());
                          } catch {
                            // continue with file save
                          }
                        }
                        const src = getThumbnailSrc(meta.thumbnail);
                        const res = await fetch(src);
                        const blob = await res.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objectUrl;
                        a.download = `${meta.title.slice(0, 40)}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(objectUrl);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download original thumbnail (free)
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#12151c] overflow-hidden">
                <div className="flex border-b border-white/10">
                  {(
                    [
                      { id: 'video' as Tab, label: 'Video', icon: Video },
                      { id: 'audio' as Tab, label: 'Audio', icon: Music },
                      { id: 'subtitles' as Tab, label: 'Subtitles', icon: Subtitles },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition ${
                        tab === id
                          ? 'border-b-2 border-primary text-primary bg-primary/5'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid h-[400px] grid-rows-[auto_1fr] gap-y-0 overflow-hidden p-4">
                  {tab === 'video' && (
                    <>
                      <p className="my-[11px] shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Download Video
                      </p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Tip: lower quality (360p/480p) downloads faster on long videos.
                      </p>
                      <div className="quality-scroll grid min-h-0 auto-rows-min gap-y-2 overflow-y-auto overscroll-contain pr-1">
                      {qualities.length > 0 ? (
                        qualities.map((q) => {
                          const isLocked = !isPro && q.height > maxQuality;
                          return (
                          <div
                            key={`${q.height}-${q.fps ?? 0}-${q.formatId}`}
                            className={`flex shrink-0 items-center justify-between rounded-xl border px-4 py-3 ${
                              isLocked
                                ? 'border-[#b0b2b5]/20 bg-[#0d1017]/80'
                                : 'border-primary/30 bg-primary/10'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-4 w-4 rounded-full border-2 ${
                                  isLocked
                                    ? 'border-primary/40 bg-primary/10'
                                    : 'border-primary bg-primary/30'
                                }`}
                              />
                              <span className="font-semibold">{q.label}</span>
                              <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
                                {q.badge}
                              </span>
                              <span className="text-xs text-muted-foreground">{q.ext}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(q.filesize)}
                              </span>
                            </div>
                            {isLocked ? (
                              <Link href="/pricing">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-primary/40 text-primary hover:bg-primary/10"
                                >
                                  Unlock Pro
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                size="sm"
                                disabled={loading}
                                className="bg-primary shadow-md shadow-primary/20 hover:bg-primary/90"
                                onClick={() => handleQualityDownload(q.height, q.formatId)}
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </Button>
                            )}
                          </div>
                          );
                        })
                      ) : (
                        <Button
                          className="w-full"
                          disabled={loading}
                          onClick={() => handleQualityDownload(720)}
                        >
                          Download best available
                        </Button>
                      )}
                      {user?.plan !== 'PRO' && maxAvail >= 2160 && (
                        <div className="flex shrink-0 items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-medium">4K Ultra HD</span>
                          </div>
                          <Link href="/pricing">
                            <Button size="sm" variant="outline">
                              Unlock Pro
                            </Button>
                          </Link>
                        </div>
                      )}
                      </div>
                    </>
                  )}

                  {tab === 'audio' && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Extract audio as high-quality MP3 from this video.
                      </p>
                      <Button
                        className="w-full gap-2"
                        disabled={loading}
                        onClick={() => startDownload('MP3')}
                      >
                        <Music className="h-4 w-4" />
                        Download MP3
                      </Button>
                    </div>
                  )}

                  {tab === 'subtitles' && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Download subtitles in SRT or VTT format.
                      </p>
                      <Button
                        className="w-full gap-2"
                        disabled={loading}
                        onClick={() => startDownload('SUBTITLE')}
                      >
                        <Subtitles className="h-4 w-4" />
                        Download Subtitles
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {download && (
                <div className="rounded-2xl border border-white/10 bg-[#12151c] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {statusLabel[download.status] ?? download.status}
                      </span>
                      {(download.status === 'QUEUED' || download.status === 'PROCESSING') && (
                        <Button variant="outline" size="sm" onClick={refreshStatus}>
                          Refresh
                        </Button>
                      )}
                    </div>
                  </div>
                  {(download.status === 'PROCESSING' || download.status === 'QUEUED') && (
                    <div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${download.progress ?? 10}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {download.progress ?? 0}% —{' '}
                        {(download.progress ?? 0) < 30
                          ? 'preparing download on server'
                          : 'downloading on server'}
                        {(meta?.duration ?? 0) >= 1800
                          ? ' · long videos may take 10–30+ minutes'
                          : ''}
                      </p>
                    </div>
                  )}
                  {download.status === 'COMPLETED' && (
                    <>
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        100% complete — ready to save
                      </div>
                      <Button onClick={saveToPc} className="w-full gap-2" size="lg">
                        <Download className="h-4 w-4" />
                        Save to your computer
                      </Button>
                    </>
                  )}
                  {download.status === 'FAILED' && download.error && (
                    <p className="text-sm text-destructive">{download.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {meta && (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#12151c] p-6">
              <h3 className="mb-4 font-semibold">More Options</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Download Audio', sub: 'MP3, M4A', href: '#', onClick: () => { setTab('audio'); } },
                  { label: 'Subtitles', sub: 'SRT, VTT', href: '#', onClick: () => { setTab('subtitles'); } },
                  { label: 'Thumbnail', sub: isPro ? 'AI tools' : 'Original JPG', href: '/thumbnail' },
                  { label: 'Playlist', sub: 'Full playlist', href: '/playlist' },
                ].map((item) => (
                  item.onClick ? (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="rounded-xl border border-white/5 bg-[#0b0e14] p-4 text-left hover:border-primary/30 transition"
                    >
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </button>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className="rounded-xl border border-white/5 bg-[#0b0e14] p-4 hover:border-primary/30 transition"
                    >
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </Link>
                  )
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#12151c] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Headphones className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{content.helpTitle}</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {content.helpLinks.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="flex items-center gap-2 hover:text-foreground">
                      <HelpCircle className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 border-t border-white/5 pt-8 text-sm text-muted-foreground">
          {content.trustBadges.map((label) => (
            <span key={label} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
