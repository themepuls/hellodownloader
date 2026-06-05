'use client';

import { CheckCircle2, HelpCircle, Loader2, XCircle } from 'lucide-react';
import type { ConnectionStatus } from '@hellodownloader/shared-types';
import { cn } from '@/lib/utils';

export function ConnectionStatusBadge({
  status,
  loading,
  lastTestedAt,
}: {
  status: ConnectionStatus;
  loading?: boolean;
  lastTestedAt?: string | null;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Testing…
      </span>
    );
  }

  const tone =
    status === 'connected'
      ? 'bg-emerald-500/15 text-emerald-400'
      : status === 'failed'
        ? 'bg-red-500/15 text-red-400'
        : 'bg-white/10 text-muted-foreground';

  const Icon = status === 'connected' ? CheckCircle2 : status === 'failed' ? XCircle : HelpCircle;
  const label =
    status === 'connected' ? 'Connected' : status === 'failed' ? 'Connection failed' : 'Not tested';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', tone)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {lastTestedAt && (
        <span className="text-xs text-muted-foreground">
          Last tested {new Date(lastTestedAt).toLocaleString()}
        </span>
      )}
    </div>
  );
}
