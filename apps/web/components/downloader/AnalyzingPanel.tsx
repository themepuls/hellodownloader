'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AnalyzingPanelProps = {
  title?: string;
  subtitle?: string;
  onCancel?: () => void;
  cancelLabel?: string;
};

export function AnalyzingPanel({
  title = 'Analyzing video…',
  subtitle = 'Fetching formats and video info from the server. This usually takes a few seconds.',
  onCancel,
  cancelLabel = 'Cancel',
}: AnalyzingPanelProps) {
  return (
    <div
      className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-6 py-12 text-center space-y-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{subtitle}</p>
      </div>
      {onCancel && (
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </div>
  );
}
