'use client';

import { Download, Link2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoUrlBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  onCancel?: () => void;
  variant?: 'hero' | 'compact';
  submitLabel?: string;
  showTerms?: boolean;
  className?: string;
}

export function VideoUrlBar({
  value,
  onChange,
  onSubmit,
  loading = false,
  onCancel,
  variant = 'compact',
  submitLabel,
  showTerms = false,
  className,
}: VideoUrlBarProps) {
  const label = submitLabel ?? (variant === 'hero' ? 'Download' : 'Analyze');
  const isHero = variant === 'hero';
  const SubmitIcon = isHero ? Download : Sparkles;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) onSubmit();
  };

  return (
    <div className={cn('w-full min-w-0', className)}>
      <div
        className={cn(
          'group/urlbar flex items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-lg shadow-black/10 dark:shadow-black/25',
          'transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:shadow-primary/10 focus-within:ring-2 focus-within:ring-primary/20',
          isHero && 'sm:gap-2 sm:p-2',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-muted px-3 py-2.5',
            'sm:gap-2.5 sm:px-3.5 sm:py-3',
          )}
        >
          <Link2 className="h-4 w-4 shrink-0 text-primary/70 sm:h-[18px] sm:w-[18px]" aria-hidden />
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isHero
                ? 'Paste video link…'
                : 'Paste YouTube, Instagram, TikTok link…'
            }
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 outline-none sm:text-[15px]"
            aria-label="Video URL"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Clear URL"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>

        {loading && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground sm:h-11 sm:w-11"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <Button
          size="default"
          className={cn(
            'h-10 shrink-0 rounded-xl bg-primary px-3 font-semibold shadow-md shadow-primary/30 hover:bg-primary/90',
            'sm:h-11 sm:px-5',
            isHero && 'sm:px-6',
          )}
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          aria-label={loading ? 'Processing' : label}
        >
          <SubmitIcon className="h-4 w-4 shrink-0" />
          <span className="hidden min-[380px]:inline">
            {loading ? (isHero ? '…' : 'Analyzing…') : label}
          </span>
        </Button>
      </div>

      {showTerms && (
        <p className="mt-2.5 px-0.5 text-center text-[11px] leading-relaxed text-muted-foreground/90 sm:mt-3 sm:text-xs">
          By using our service you accept our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      )}
    </div>
  );
}
