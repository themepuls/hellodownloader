'use client';

import Image from 'next/image';
import { CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getThumbnailSrc } from '@/lib/thumbnail';
import type { ThumbnailPreview } from '@hellodownloader/shared-types';

type ThumbnailInfoCardProps = {
  preview: ThumbnailPreview;
  resolution?: string;
  onResolutionDetected?: (width: number, height: number) => void;
  onDownload?: () => void;
  downloading?: boolean;
};

export function ThumbnailInfoCard({
  preview,
  resolution,
  onResolutionDetected,
  onDownload,
  downloading,
}: ThumbnailInfoCardProps) {
  const displayResolution = resolution ?? preview.resolution ?? 'Detecting…';

  return (
    <Card className="border-emerald-500/20 bg-background/60 overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">Thumbnail Loaded</span>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black/40">
          <Image
            src={getThumbnailSrc(preview.thumbnail)}
            alt={preview.title}
            fill
            className="object-contain"
            unoptimized
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                onResolutionDetected?.(img.naturalWidth, img.naturalHeight);
              }
            }}
          />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-1">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-muted-foreground shrink-0 sm:w-24">Video</dt>
            <dd className="font-medium break-words">{preview.title}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-muted-foreground shrink-0 sm:w-24">Channel</dt>
            <dd className="font-medium break-words">{preview.channel}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-muted-foreground shrink-0 sm:w-24">Resolution</dt>
            <dd className="font-medium tabular-nums">
              {displayResolution.replace('x', '×')}
              {preview.width && preview.height && preview.width >= 1280 && (
                <span className="ml-2 inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                  Max quality
                </span>
              )}
            </dd>
          </div>
          {preview.maxQualityNote && (
            <p className="text-xs leading-relaxed text-muted-foreground border-t border-border pt-2">
              {preview.maxQualityNote}
            </p>
          )}
        </dl>

        {onDownload && (
          <Button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="w-full gap-2"
            variant="secondary"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Downloading…' : 'Download original thumbnail (free)'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
