'use client';

interface BannerAdProps {
  plan?: string;
}

/** Ad placeholder — swap slot IDs for AdSense/network in production */
export function BannerAd({ plan }: BannerAdProps) {
  if (plan === 'PRO') return null;

  return (
    <div
      className="mb-6 flex h-24 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-sm text-muted-foreground"
      data-ad-slot="banner-1"
      role="complementary"
      aria-label="Advertisement"
    >
      Banner Ad Placeholder
    </div>
  );
}
