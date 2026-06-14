'use client';

import { useEffect, useRef, useState } from 'react';
import { getThumbnailDownloadSrc, getThumbnailSrc } from '@/lib/thumbnail';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Headphones,
  HelpCircle,
  Music,
  Subtitles,
  Video,
} from 'lucide-react';
import { VideoUrlBar } from '@/components/downloader/VideoUrlBar';
import { AnalyzingPanel } from '@/components/downloader/AnalyzingPanel';
import { FourKInterestSurvey } from '@/components/downloader/FourKInterestSurvey';
import { JobStatusPanel } from '@/components/downloader/JobStatusPanel';
import {
  ToolPageAdsBottom,
  ToolPageAdsTop,
  ToolPageWithSidebar,
} from '@/components/ads/ToolPageAds';
import { Button } from '@/components/ui/button';
import { useDownloader } from '@/hooks/useDownloader';
import { useAffiliateOnSave } from '@/hooks/useAffiliateOnSave';
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
  DEFAULT_HD_QUALITY_ACCESS,
  detectPlatform,
  hasProAccess,
  isQualityAccessible,
  isSocialPlatform,
  type DownloadPageContent,
  type HdQualityAccessConfig,
} from '@hellodownloader/shared-types';

type Tab = 'video' | 'audio' | 'subtitles';

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
  const isPro = hasProAccess(user?.plan, user?.role);
  const [qualityAccess, setQualityAccess] = useState<HdQualityAccessConfig>(
    DEFAULT_HD_QUALITY_ACCESS,
  );
  const [tab, setTab] = useState<Tab>('video');
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [thumbnailSaving, setThumbnailSaving] = useState(false);
  const autoAnalyzed = useRef(false);

  const {
    url,
    setUrl,
    metadata,
    loading,
    analyzing,
    saving,
    saveStarted,
    error,
    download,
    fetchMetadata,
    startDownload,
    saveToPc,
    refreshStatus,
    cancelAnalysis,
    cancelDownload,
    setError,
  } = useDownloader(initialUrl);
  const openDownloadAffiliate = useAffiliateOnSave('download');

  useEffect(() => {
    void apiClient.downloads
      .qualityAccess()
      .then((data) => setQualityAccess({ ...DEFAULT_HD_QUALITY_ACCESS, ...(data as HdQualityAccessConfig) }))
      .catch(() => setQualityAccess(DEFAULT_HD_QUALITY_ACCESS));
  }, []);

  useEffect(() => {
    if (autoAnalyze && initialUrl && !autoAnalyzed.current) {
      autoAnalyzed.current = true;
      setThumbnailFailed(false);
      void fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze, initialUrl]);

  const meta = metadata as VideoMetadata | null;
  const platform = detectPlatform(url);
  const isSocial = isSocialPlatform(platform);
  const socialSourceLabel =
    platform === 'instagram'
      ? 'Instagram'
      : platform === 'facebook'
        ? 'Facebook'
        : platform === 'tiktok'
          ? 'TikTok'
          : 'the platform';

  const processingPhaseMessage = (progress: number) => {
    if (progress < 30) {
      return isSocial
        ? `fetching from ${socialSourceLabel} on server — often 1–2 min even for small files`
        : 'preparing download on server';
    }
    if (progress >= 90) return 'finishing download on server';
    if (progress >= 85) return 'saving file on server';
    return isSocial ? `downloading from ${socialSourceLabel} on server` : 'downloading on server';
  };

  useEffect(() => {
    setThumbnailFailed(false);
  }, [meta?.id, meta?.thumbnail]);
  const qualities = meta
    ? getVideoQualityOptions(meta.formats, 4320, meta.duration)
    : [];
  const maxAvail = meta ? getMaxQuality(meta.formats) : 0;
  const isQualityLocked = (height: number) => !isQualityAccessible(height, qualityAccess, isPro);
  const hasLockedHd = qualities.some((q) => isQualityLocked(q.height));
  const availableQualities = qualities.filter((q) => !isQualityLocked(q.height));
  const lockedQualities = qualities.filter((q) => isQualityLocked(q.height));

  const handleAnalyze = () => {
    setThumbnailFailed(false);
    void fetchMetadata();
  };

  const handleQualityDownload = (height: number, formatId?: string) => {
    void startDownload('VIDEO', height, formatId?.trim() || undefined);
  };

  const saveOriginalThumbnail = async () => {
    if (!meta?.thumbnail || !url.trim() || thumbnailSaving) return;
    setThumbnailSaving(true);
    openDownloadAffiliate();
    try {
      void apiClient.thumbnails
        .saveOriginal(url.trim(), {
          thumbnailUrl: meta.thumbnail,
          title: meta.title,
        })
        .catch(() => undefined);

      const res = await fetch(getThumbnailDownloadSrc(meta.thumbnail));
      if (!res.ok) {
        throw new Error('Could not download thumbnail');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const safeTitle =
        meta.title.replace(/[/\\?%*:|"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) ||
        'thumbnail';
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${safeTitle}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Could not download thumbnail. Try again.');
    } finally {
      setThumbnailSaving(false);
    }
  };

  const renderQualityRow = (
    q: (typeof qualities)[number],
    options: { locked?: boolean },
  ) => (
    <div
      key={`${q.height}-${q.fps ?? 0}-${q.formatId}`}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        options.locked
          ? 'border-border bg-secondary/60 opacity-75'
          : 'border-primary/30 bg-primary/10'
      }`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        <div
          className={`h-4 w-4 shrink-0 rounded-full border-2 ${
            options.locked
              ? 'border-border bg-accent/50'
              : 'border-primary bg-primary/30'
          }`}
        />
        <span className="font-semibold">{q.label}</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {q.badge}
        </span>
        <span className="text-xs text-muted-foreground">{q.ext}</span>
        <span className="text-xs text-muted-foreground">
          {q.filesize ? `~${formatFileSize(q.filesize)} est.` : '—'}
        </span>
      </div>
      {options.locked ? (
        <span className="shrink-0 text-xs text-muted-foreground">Soon</span>
      ) : (
        <Button
          size="sm"
          disabled={loading}
          className="shrink-0 bg-primary shadow-md shadow-primary/20 hover:bg-primary/90"
          onClick={() => handleQualityDownload(q.height, q.formatId)}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <ToolPageAdsTop page="download" />
      <div className="border-b border-border/60 bg-secondary/80 px-3 py-5 sm:px-4 sm:py-8">
        <div className="container mx-auto max-w-5xl min-w-0">
          <VideoUrlBar
            value={url}
            onChange={setUrl}
            onSubmit={handleAnalyze}
            loading={analyzing}
            onCancel={cancelAnalysis}
            variant="compact"
            submitLabel={content.analyzeButton}
          />
          {error && !analyzing && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
          {meta && !analyzing && !error && (
            <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {content.successText}
            </p>
          )}
          {meta && hasLockedHd && (
            <div className="mt-4">
              <FourKInterestSurvey />
            </div>
          )}
        </div>
      </div>

      <ToolPageWithSidebar page="download">
        {!meta && !analyzing && !download && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-24 text-center">
            <Video className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">{content.emptyTitle}</h2>
            <p className="text-muted-foreground">{content.emptySubtitle}</p>
          </div>
        )}

        {analyzing && (
          <AnalyzingPanel
            title={content.loadingText ?? 'Analyzing video…'}
            onCancel={cancelAnalysis}
          />
        )}

        {!analyzing && download && !meta && (
          <div className="mx-auto max-w-lg space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Resumed download</p>
                <h2 className="text-lg font-semibold">{download.title ?? 'Video download'}</h2>
              </div>
              <JobStatusPanel
                status={download.status as 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'}
                progress={download.progress ?? 10}
                error={download.error}
                processingHint="Download runs on the server — keep this tab open."
                onCancel={
                  download.status === 'QUEUED' || download.status === 'PROCESSING'
                    ? cancelDownload
                    : undefined
                }
              >
                {download.status === 'COMPLETED' && (
                  <div className="space-y-3 pt-1">
                    {error && (
                      <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                    )}
                    {saveStarted ? (
                      <div className="space-y-2">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Download started — check your browser&apos;s download panel.
                        </p>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          size="lg"
                          onClick={saveToPc}
                          disabled={saving}
                        >
                          <Download className="h-4 w-4" />
                          {saving ? 'Starting download…' : 'Try again'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={saveToPc}
                        disabled={saving}
                        className="w-full gap-2"
                        size="lg"
                      >
                        <Download className="h-4 w-4" />
                        {saving ? 'Starting download…' : 'Save to your computer'}
                      </Button>
                    )}
                  </div>
                )}
              </JobStatusPanel>
              <Button variant="outline" className="w-full" onClick={fetchMetadata} disabled={analyzing}>
                {analyzing ? 'Loading video info…' : 'Reload video info'}
              </Button>
            </div>
          </div>
        )}

        {meta && !analyzing && (
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
                      disabled={thumbnailSaving}
                      onClick={() => void saveOriginalThumbnail()}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {thumbnailSaving ? 'Saving…' : 'Download original thumbnail (free)'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex border-b border-border">
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

                <div className="flex h-[min(420px,70vh)] min-h-[280px] flex-col overflow-hidden p-4">
                  {tab === 'video' && (
                    <>
                      <div className="shrink-0 space-y-1 pb-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Download Video
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tip: lower quality (360p/480p) downloads faster on long videos.
                        </p>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                        {qualities.length > 0 ? (
                          <>
                            {availableQualities.map((q) => renderQualityRow(q, { locked: false }))}
                            {lockedQualities.length > 0 && (
                              <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                HD &amp; 4K — coming soon
                              </p>
                            )}
                            {lockedQualities.map((q) => renderQualityRow(q, { locked: true }))}
                          </>
                        ) : (
                          <Button
                            className="w-full"
                            disabled={loading}
                            onClick={() => handleQualityDownload(720)}
                          >
                            Download best available
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {tab === 'audio' && (
                    <div className="flex flex-1 flex-col justify-center space-y-4">
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
                    <div className="flex flex-1 flex-col justify-center space-y-4">
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
                <JobStatusPanel
                  status={download.status as 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'}
                  progress={download.progress ?? 10}
                  error={download.error}
                  warning={download.warning}
                  onRefresh={refreshStatus}
                  onCancel={
                    download.status === 'QUEUED' || download.status === 'PROCESSING'
                      ? cancelDownload
                      : undefined
                  }
                  processingDetail={
                    (download.status === 'PROCESSING' || download.status === 'QUEUED') ? (
                      <p className="text-xs text-muted-foreground">
                        {download.progress ?? 0}% — {processingPhaseMessage(download.progress ?? 0)}
                        {(meta?.duration ?? 0) >= 1800
                          ? ' · long videos may take 10–30+ minutes'
                          : ''}
                      </p>
                    ) : undefined
                  }
                >
                  {download.status === 'COMPLETED' && (
                    <div className="space-y-3 border-t border-border pt-3">
                      {download.fileSize &&
                        Number(download.fileSize) > 100 * 1024 * 1024 && (
                          <p className="text-xs text-muted-foreground">
                            Large file ({formatFileSize(Number(download.fileSize))}) — your browser
                            will ask where to save it.
                          </p>
                        )}
                      {error && <p className="text-sm text-red-700 dark:text-red-200">{error}</p>}
                      {saveStarted ? (
                        <div className="space-y-2">
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            {(() => {
                              const res = download.actualHeight ?? download.quality;
                              const size = download.fileSize
                                ? formatFileSize(Number(download.fileSize))
                                : null;
                              const detail =
                                res && size
                                  ? ` (${res}p, ${size})`
                                  : size
                                    ? ` (${size})`
                                    : res
                                      ? ` (${res}p)`
                                      : '';
                              return `Download started — check your browser's download panel${detail}.`;
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Large files can take several minutes. Keep this tab open until the
                            transfer finishes.
                          </p>
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            size="lg"
                            onClick={saveToPc}
                            disabled={saving}
                          >
                            <Download className="h-4 w-4" />
                            {saving ? 'Starting download…' : 'Try again'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={saveToPc}
                          disabled={saving || loading}
                          className="w-full gap-2"
                          size="lg"
                        >
                          <Download className="h-4 w-4" />
                          {saving ? 'Starting download…' : 'Save to your computer'}
                        </Button>
                      )}
                    </div>
                  )}
                </JobStatusPanel>
              )}
            </div>
          </div>
        )}

        {meta && !analyzing && (
          <>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 font-semibold">More Options</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Download Audio', sub: 'MP3, M4A', href: '#', onClick: () => { setTab('audio'); } },
                  { label: 'Subtitles', sub: 'SRT, VTT', href: '#', onClick: () => { setTab('subtitles'); } },
                  { label: 'Thumbnail', sub: 'Original JPG', href: '/thumbnail' },
                  { label: 'Playlist', sub: 'Full playlist', href: '/playlist' },
                ].map((item) => (
                  item.onClick ? (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="rounded-xl border border-border/60 bg-background p-4 text-left hover:border-primary/30 transition"
                    >
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </button>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href!}
                      className="rounded-xl border border-border/60 bg-background p-4 hover:border-primary/30 transition"
                    >
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </Link>
                  )
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
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
          </>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 border-t border-border/60 pt-8 text-sm text-muted-foreground">
          {content.trustBadges.map((label) => (
            <span key={label} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </ToolPageWithSidebar>
      <ToolPageAdsBottom page="download" />
    </div>
  );
}
