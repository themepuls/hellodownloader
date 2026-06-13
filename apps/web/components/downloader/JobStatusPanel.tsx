'use client';

import type { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type JobStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting',
  QUEUED: 'Starting',
  PROCESSING: 'In progress',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
};

function hintForError(error: string): string | null {
  if (/no subtitles/i.test(error)) {
    return 'This video may have no captions, or subtitles are disabled. Try a video with CC enabled on YouTube.';
  }
  if (/unavailable or private/i.test(error)) {
    return 'The video may be private, deleted, or blocked in your region.';
  }
  if (/age-restricted|sign-in|login/i.test(error)) {
    return 'Age-restricted videos need YouTube cookies configured on the server.';
  }
  if (/timed out/i.test(error)) {
    return 'Try again with a lower quality, or wait and retry for long videos.';
  }
  if (/name resolution|ENOTFOUND|network\/dns|unreachable from the server/i.test(error)) {
    return 'The server had trouble reaching that site. YouTube links usually work — try again in a minute.';
  }
  if (/instagram requires login|facebook requires login|empty media response|cannot parse data/i.test(error)) {
    return 'This post may be private or blocked. Public YouTube and TikTok links usually work without login.';
  }
  if (/playlist/i.test(error) && /skipped|private|unavailable/i.test(error)) {
    return 'Some playlist items could not be downloaded. The ZIP includes everything that was accessible.';
  }
  return null;
}

type PanelTone = 'processing' | 'success' | 'error' | 'warning';

function toneForStatus(status: JobStatus, warning?: string | null): PanelTone {
  if (status === 'FAILED') return 'error';
  if (status === 'COMPLETED' && warning) return 'warning';
  if (status === 'COMPLETED') return 'success';
  return 'processing';
}

const TONE_STYLES: Record<
  PanelTone,
  { shell: string; badge: string; icon: string; message: string }
> = {
  processing: {
    shell: 'border-primary/25 bg-primary/[0.06]',
    badge: 'bg-primary/15 text-primary ring-1 ring-primary/30',
    icon: 'text-primary',
    message: 'text-foreground/90',
  },
  success: {
    shell: 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/[0.08]',
    badge: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/35 dark:text-emerald-300',
    icon: 'text-emerald-600 dark:text-emerald-400',
    message: 'text-emerald-800 dark:text-emerald-100',
  },
  error: {
    shell: 'border-red-500/35 bg-red-500/10 dark:bg-red-500/[0.1]',
    badge: 'bg-red-500/15 text-red-700 ring-1 ring-red-500/40 dark:text-red-200',
    icon: 'text-red-600 dark:text-red-400',
    message: 'text-red-800 dark:text-red-100',
  },
  warning: {
    shell: 'border-amber-500/35 bg-amber-500/10 dark:bg-amber-500/[0.08]',
    badge: 'bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
    message: 'text-amber-900 dark:text-amber-100',
  },
};

function StatusIcon({ tone, status }: { tone: PanelTone; status: JobStatus }) {
  const className = cn('h-5 w-5 shrink-0', TONE_STYLES[tone].icon);
  if (status === 'FAILED') return <AlertCircle className={className} aria-hidden />;
  if (status === 'COMPLETED') {
    return tone === 'warning' ? (
      <AlertTriangle className={className} aria-hidden />
    ) : (
      <CheckCircle2 className={className} aria-hidden />
    );
  }
  return <Loader2 className={cn(className, 'animate-spin')} aria-hidden />;
}

export interface JobStatusPanelProps {
  status: JobStatus;
  progress?: number;
  error?: string | null;
  /** Non-fatal notice on completed jobs (e.g. skipped playlist items). */
  warning?: string | null;
  processingDetail?: ReactNode;
  processingHint?: string;
  onRefresh?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
  className?: string;
}

export function JobStatusPanel({
  status,
  progress = 0,
  error,
  warning,
  processingDetail,
  processingHint,
  onRefresh,
  onCancel,
  children,
  className,
}: JobStatusPanelProps) {
  const isProcessing = status === 'QUEUED' || status === 'PROCESSING' || status === 'PENDING';
  const isFailed = status === 'FAILED';
  const isComplete = status === 'COMPLETED';
  const tone = toneForStatus(status, warning);
  const styles = TONE_STYLES[tone];
  const hint = error ? hintForError(error) : null;
  const displayMessage = isFailed
    ? (() => {
        const raw = error?.trim();
        if (!raw || raw === 'undefined' || raw === 'null') {
          return 'Download failed. Try a lower quality or another link.';
        }
        return raw;
      })()
    : isComplete && warning
      ? warning
      : null;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isProcessing ? TONE_STYLES.processing.shell : styles.shell,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <StatusIcon tone={isProcessing ? 'processing' : tone} status={status} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Download status
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                isProcessing ? TONE_STYLES.processing.badge : styles.badge,
              )}
            >
              {STATUS_LABEL[status] ?? status.toLowerCase()}
            </span>
          </div>

          {isProcessing && (
            <>
              {processingDetail}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(progress, 8)}%` }}
                />
              </div>
              {processingHint && (
                <p className="text-xs leading-relaxed text-muted-foreground">{processingHint}</p>
              )}
            </>
          )}

          {displayMessage && (
            <p className={cn('text-sm font-medium leading-snug', styles.message)}>{displayMessage}</p>
          )}

          {hint && (
            <p className="text-xs leading-relaxed text-muted-foreground border-t border-border pt-2 mt-2">
              {hint}
            </p>
          )}
        </div>

        {isProcessing && (onRefresh || onCancel) && (
          <div className="flex shrink-0 flex-col gap-1.5">
            {onRefresh && (
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            )}
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
