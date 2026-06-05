'use client';

import { Download, Link2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoUrlBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
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
  variant = 'compact',
  submitLabel,
  showTerms = false,
  className,
}: VideoUrlBarProps) {
  const label = submitLabel ?? (variant === 'hero' ? 'Download' : 'Analyze');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) onSubmit();
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12151c]/90 p-2 shadow-xl shadow-black/20 backdrop-blur-sm',
          variant === 'hero' && 'p-2.5',
        )}
      >
        <div className="flex flex-1 items-center gap-3 pl-3 min-w-0">
          <Link2 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste YouTube, Instagram, Facebook, TikTok, or Twitter/X link..."
            className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              aria-label="Clear URL"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          size={variant === 'hero' ? 'lg' : 'default'}
          className="shrink-0 rounded-xl bg-primary px-6 font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90"
          onClick={onSubmit}
          disabled={!value.trim() || loading}
        >
          {variant === 'compact' ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {loading ? 'Working…' : label}
        </Button>
      </div>
      {showTerms && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          By using our service you accept our{' '}
          <a href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      )}
    </div>
  );
}
