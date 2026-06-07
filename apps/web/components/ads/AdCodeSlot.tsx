'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { hasAdContent, resolveAdSlotContent } from '@/lib/ad-tag-parser';
import { cleanupAdAssets, injectAdAssets, waitForAdSlotLayout } from '@/lib/inject-ad-scripts';

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
  const htmlHostRef = useRef<HTMLDivElement>(null);
  const scriptHostRef = useRef<HTMLDivElement>(null);
  const hasCustom = hasAdContent(adTag, html, css, js);
  const contentKey = `${adTag}\0${html}\0${css}\0${js}`;
  const parsed = useMemo(() => resolveAdSlotContent(adTag, html, css, js), [contentKey]);

  useEffect(() => {
    const slotParsed = resolveAdSlotContent(adTag, html, css, js);
    const htmlHost = htmlHostRef.current;
    const scriptHost = scriptHostRef.current;
    if (!htmlHost || !scriptHost) return;

    htmlHost.innerHTML = slotParsed.html;

    const hasScripts =
      slotParsed.scripts.length > 0 ||
      slotParsed.stylesheets.length > 0 ||
      Boolean(slotParsed.headHtml);

    if (!hasScripts) {
      return () => {
        htmlHost.innerHTML = '';
      };
    }

    let cancelled = false;
    void waitForAdSlotLayout(htmlHost).then(() => {
      if (cancelled) return;
      return injectAdAssets(
        { ...slotParsed, html: '' },
        {
          markerId,
          htmlHost: scriptHost,
          scriptHost,
        },
      );
    }).then(() => {
      if (cancelled) cleanupAdAssets(markerId);
    });

    return () => {
      cancelled = true;
      htmlHost.innerHTML = '';
      cleanupAdAssets(markerId);
    };
  }, [contentKey, markerId, adTag, html, css, js]);

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
      <div ref={htmlHostRef} className="ad-slot-html min-w-0 w-full [&_.adsbygoogle]:block [&_.adsbygoogle]:w-full" />
      <div ref={scriptHostRef} className="ad-slot-scripts" aria-hidden />
    </div>
  );
}
