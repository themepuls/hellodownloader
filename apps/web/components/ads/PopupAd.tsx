'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdCodeSlot } from './AdCodeSlot';

interface PopupAdProps {
  delayMs?: number;
  slotId?: string;
  adTag?: string;
  html?: string;
  css?: string;
  js?: string;
}

export function PopupAd({
  delayMs = 30000,
  slotId = 'popup-1',
  adTag = '',
  html = '',
  css = '',
  js = '',
}: PopupAdProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-w-lg w-full rounded-xl border border-border bg-card p-4 shadow-xl">
        <Button
          variant="outline"
          size="sm"
          className="absolute right-3 top-3 z-10 h-8 px-2"
          onClick={() => setOpen(false)}
        >
          Close
        </Button>
        <AdCodeSlot
          slotId={slotId}
          placement="popup"
          adTag={adTag}
          html={html}
          css={css}
          js={js}
          className="min-h-[120px] rounded-lg border-0 bg-transparent pt-8"
          fallbackLabel="Popup advertisement"
        />
      </div>
    </div>
  );
}
