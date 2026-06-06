'use client';

import { useEffect, useId, useRef } from 'react';
import { hasAdContent, resolveAdSlotContent } from '@/lib/ad-tag-parser';
import { cleanupAdAssets, injectAdAssets } from '@/lib/inject-ad-scripts';

type AdCodeSlotProps = {
  slotId: string;
  placement?: string;
  adTag?: string;
  html?: string;
  css?: string;
  js?: string;
  className?: string;
  fallbackLabel?: string;
};

/** Renders ad code from any network — paste full tag or use split HTML/CSS/JS. */
export function AdCodeSlot({
  slotId,
  placement,
  adTag = '',
  html = '',
  css = '',
  js = '',
  className,
  fallbackLabel = 'Advertisement',
}: AdCodeSlotProps) {
  const reactId = useId();
  const markerId = `${slotId}-${placement ?? 'default'}-${reactId}`.replace(/:/g, '');
  const scriptHostRef = useRef<HTMLDivElement>(null);
  const hasCustom = hasAdContent(adTag, html, css, js);
  const parsed = resolveAdSlotContent(adTag, html, css, js);

  useEffect(() => {
    const host = scriptHostRef.current;
    if (!host) return;
    if (parsed.scripts.length === 0 && parsed.stylesheets.length === 0 && !parsed.headHtml) {
      return;
    }

    let cancelled = false;
    void injectAdAssets(parsed, {
      markerId,
      htmlHost: host,
      scriptHost: host,
    }).then(() => {
      if (cancelled) cleanupAdAssets(markerId);
    });

    return () => {
      cancelled = true;
      cleanupAdAssets(markerId);
    };
  }, [adTag, html, css, js, markerId, parsed.headHtml, parsed.scripts.length, parsed.stylesheets.length]);

  if (!hasCustom) return null;

  return (
    <div
      className={
        className ??
        'relative min-h-[90px] overflow-hidden rounded-xl border border-border bg-card/80'
      }
      data-ad-slot={slotId}
      data-ad-placement={placement}
      role="complementary"
      aria-label="Advertisement"
    >
      {parsed.css ? <style data-ad-style={markerId}>{parsed.css}</style> : null}
      {parsed.html ? (
        <div className="ad-slot-html" dangerouslySetInnerHTML={{ __html: parsed.html }} />
      ) : null}
      <div ref={scriptHostRef} className="ad-slot-scripts" aria-hidden />
    </div>
  );
}
