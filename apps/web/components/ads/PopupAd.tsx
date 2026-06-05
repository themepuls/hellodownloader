'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface PopupAdProps {
  plan?: string;
  delayMs?: number;
}

export function PopupAd({ plan, delayMs = 30000 }: PopupAdProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (plan === 'PRO') return;
    const t = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(t);
  }, [plan, delayMs]);

  if (!open || plan === 'PRO') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-w-md rounded-lg bg-card p-6 shadow-xl border">
        <p className="text-sm text-muted-foreground mb-4">Advertisement</p>
        <div className="h-32 rounded bg-muted flex items-center justify-center mb-4" data-ad-slot="popup-1">
          Popup Ad Placeholder
        </div>
        <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
