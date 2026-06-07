'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { saveCompletedFile } from '@/lib/save-file';
import { useAffiliateOnSave } from '@/hooks/useAffiliateOnSave';
import { thumbnailExportUrl } from '@/lib/thumbnail';
import {
  ThumbnailStatus,
  type ThumbnailRecord,
} from '@hellodownloader/shared-types';

const RATIO_LABELS: Record<string, string> = {
  YOUTUBE_16_9: 'YouTube 16:9',
  SHORTS_9_16: 'Shorts 9:16',
  INSTAGRAM_4_5: 'Instagram 4:5',
  FACEBOOK_1_1: 'Facebook 1:1',
};

const MODE_LABELS: Record<string, string> = {
  adjust: 'AI Adjust',
  generate: 'AI Generate',
};

type ThumbnailJobResultCardProps = {
  job: ThumbnailRecord;
  onComplete?: (job: ThumbnailRecord) => void;
  onCancel?: () => void;
};

function isProcessing(status: ThumbnailStatus) {
  return status === ThumbnailStatus.PENDING || status === ThumbnailStatus.PROCESSING;
}

function resolveMode(ocrData: unknown): string {
  if (ocrData && typeof ocrData === 'object' && 'mode' in ocrData) {
    const mode = (ocrData as { mode?: string }).mode;
    if (mode === 'adjust' || mode === 'generate') return mode;
  }
  return 'adjust';
}

export function ThumbnailJobResultCard({ job: initialJob, onComplete, onCancel }: ThumbnailJobResultCardProps) {
  const [job, setJob] = useState(initialJob);
  const [downloading, setDownloading] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const openAffiliate = useAffiliateOnSave('thumbnail');

  const mode = resolveMode(job.ocrData);
  const modeLabel = MODE_LABELS[mode] ?? 'AI Thumbnail';
  const ratioLabel = RATIO_LABELS[job.ratio] ?? job.ratio;
  const isPortrait =
    job.ratio === 'SHORTS_9_16' || job.ratio === 'INSTAGRAM_4_5';
  const processing = isProcessing(job.status as ThumbnailStatus);
  const completed = job.status === ThumbnailStatus.COMPLETED;
  const failed = job.status === ThumbnailStatus.FAILED;

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob.id, initialJob.updatedAt]);

  useEffect(() => {
    if (!processing) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const updated = (await apiClient.thumbnails.get(initialJob.id)) as ThumbnailRecord;
        if (cancelled) return;
        setJob(updated);
        if (updated.status === ThumbnailStatus.COMPLETED) {
          setPreviewKey((k) => k + 1);
          onComplete?.(updated);
        }
      } catch {
        // keep polling on transient errors
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll until terminal status; onComplete is optional toast
  }, [initialJob.id, processing]);

  const handleDownload = async () => {
    openAffiliate();
    setDownloading(true);
    try {
      await saveCompletedFile(
        `/thumbnails/${job.id}/file?download=1`,
        `thumbnail-${job.ratio.toLowerCase()}.jpg`,
        { auth: true, fileExtension: '.jpg' },
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="border-primary/25 bg-background/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{modeLabel} Result</CardTitle>
          <StatusBadge status={job.status as ThumbnailStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-2 py-0.5">{ratioLabel}</span>
          {job.creditsUsed > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5">
              {job.creditsUsed} credit{job.creditsUsed === 1 ? '' : 's'} used
            </span>
          )}
        </div>

        {processing && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary mt-0.5" />
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-medium">
                {job.status === ThumbnailStatus.PROCESSING
                  ? 'Processing your thumbnail…'
                  : 'Starting thumbnail job…'}
              </p>
              <p className="text-muted-foreground text-xs">
                Resizing, running OCR, and preparing your export. This usually takes a few seconds.
              </p>
            </div>
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" className="shrink-0 h-8" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        )}

        {failed && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-destructive">Processing failed</p>
              <p className="text-muted-foreground text-xs">
                {job.error ?? 'Something went wrong on the server. Try again or contact support.'}
              </p>
            </div>
          </div>
        )}

        {completed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Your thumbnail is ready</span>
            </div>
            <div
              className={
                isPortrait
                  ? 'mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border border-border bg-black/40'
                  : 'overflow-hidden rounded-lg border border-border bg-black/40'
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={previewKey}
                src={`${thumbnailExportUrl(job.id)}?t=${previewKey}`}
                alt={`${modeLabel} preview`}
                className="w-full h-auto object-cover"
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download thumbnail
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ThumbnailStatus }) {
  if (status === ThumbnailStatus.COMPLETED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    );
  }
  if (status === ThumbnailStatus.FAILED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  if (status === ThumbnailStatus.PROCESSING) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Queued
    </span>
  );
}
