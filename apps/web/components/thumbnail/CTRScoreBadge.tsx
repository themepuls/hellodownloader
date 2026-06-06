'use client';

import { cn } from '@/lib/utils';

type CTRScoreBadgeProps = {
  score: number;
  className?: string;
};

function scoreTone(score: number): string {
  if (score >= 80) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (score >= 60) return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return 'border-red-500/40 bg-red-500/10 text-red-300';
}

export function CTRScoreBadge({ score, className }: CTRScoreBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums',
        scoreTone(clamped),
        className,
      )}
    >
      {clamped}/100
    </span>
  );
}
