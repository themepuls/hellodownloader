'use client';

import { Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CTRScoreBadge } from '@/components/thumbnail/CTRScoreBadge';
import { formatStrategyCopyText, type ThumbnailStrategyResult } from '@hellodownloader/shared-types';

type HeadlinePreviewCardProps = {
  headline: ThumbnailStrategyResult;
  onRegenerate: () => void;
  onCopy: () => void;
  regenerating?: boolean;
};

export function HeadlinePreviewCard({
  headline,
  onRegenerate,
  onCopy,
  regenerating,
}: HeadlinePreviewCardProps) {
  const copyText = formatStrategyCopyText(headline);

  return (
    <Card className="border-primary/25 bg-background/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Thumbnail Strategy</CardTitle>
          <div className="flex items-center gap-2">
            <CTRScoreBadge score={headline.ctrScore} />
            {headline.thumbnailScore > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Quality {headline.thumbnailScore}/100
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {headline.detectedCategory && (
            <span className="rounded-full border border-border px-2 py-0.5">
              {headline.detectedCategory}
            </span>
          )}
          {headline.detectedTextStyle && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
              {headline.detectedTextStyle}
            </span>
          )}
          {headline.layout && (
            <span className="rounded-full border border-border px-2 py-0.5">
              {headline.layout}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Headline
            </p>
            <p className="text-lg font-bold leading-snug">{headline.headline}</p>
          </div>
          {headline.subheadline && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Subheadline
              </p>
              <p className="text-base font-semibold text-primary/90">{headline.subheadline}</p>
            </div>
          )}
          {headline.textBlocks.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Text Blocks
              </p>
              <ul className="space-y-1 text-sm">
                {headline.textBlocks.map((block, i) => (
                  <li key={`text-block-${i}-${block.slice(0, 40)}`} className="font-medium">
                    {block}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Emotion
              </p>
              <p className="text-sm">{headline.emotion}</p>
            </div>
            {headline.textPosition && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Text Position
                </p>
                <p className="text-sm">{headline.textPosition}</p>
              </div>
            )}
          </div>
          {headline.recommendedColors.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Recommended Colors
              </p>
              <p className="text-sm">{headline.recommendedColors.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className={regenerating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={onCopy}
            disabled={!copyText}
          >
            <Copy className="h-4 w-4" />
            Copy Headline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
