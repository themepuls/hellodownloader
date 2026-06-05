'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';

const proFeatures = [
  '1080p, 4K & 8K video downloads',
  'AI thumbnail adjust (text + image, OCR)',
  'Multiple thumbnail ratios (16:9, 9:16, 4:5, 1:1)',
  'Full AI thumbnail generation with prompts',
  'Global + custom user prompts',
  'No ads',
  'Unlimited download history',
  '100 credits/month',
];

const freeFeatures = [
  'Unlimited downloads up to 720p',
  'Playlist ZIP export (720p)',
  'Original thumbnail download',
  'MP3 / audio download',
  'Subtitle download (SRT, VTT)',
  '7-day download history (with signup)',
  'Ads supported',
  'YouTube, Facebook, Instagram, TikTok, Twitter/X',
];

type PaymentGateway = 'stripe' | 'binance' | 'sslcommerz';

export default function PricingPage() {
  const user = useUserStore((s) => s.user);
  const [loading, setLoading] = useState<PaymentGateway | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (gateway: PaymentGateway) => {
    setLoading(gateway);
    setError(null);
    try {
      if (gateway === 'stripe') {
        const res = await apiClient.billing.checkout() as { url: string };
        window.location.href = res.url;
      } else if (gateway === 'binance') {
        const res = await apiClient.billing.binanceCheckout() as { checkoutUrl: string };
        window.location.href = res.checkoutUrl;
      } else {
        const res = await apiClient.billing.sslcommerzCheckout() as { redirectUrl: string };
        window.location.href = res.redirectUrl;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment gateway error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const isPro = user?.plan === 'PRO';

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple Pricing</h1>
        <p className="text-muted-foreground text-lg">
          Downloads, playlists, audio, and subtitles are free. Pro unlocks AI thumbnails and HD/4K.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">$0 / forever</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled={!user || isPro}>
              {!user ? 'Sign up free' : isPro ? 'Included in Pro' : 'Current Plan'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pro
              {isPro && <span className="text-xs font-normal bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Active</span>}
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">$9.99 / month</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />{f}
                </li>
              ))}
            </ul>

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            {!isPro && (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => handleUpgrade('stripe')} disabled={loading !== null}>
                  {loading === 'stripe' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Pay with Stripe
                </Button>
                <Button variant="outline" className="w-full" onClick={() => handleUpgrade('binance')} disabled={loading !== null}>
                  {loading === 'binance' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Pay with Binance Pay (USDT)
                </Button>
                <Button variant="outline" className="w-full" onClick={() => handleUpgrade('sslcommerz')} disabled={loading !== null}>
                  {loading === 'sslcommerz' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Pay with SSLCommerz (BDT ৳1,099)
                </Button>
              </div>
            )}
            {isPro && <Button variant="outline" className="w-full" disabled>You are on Pro</Button>}
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-10 text-sm text-muted-foreground space-y-1">
        <p>Pro credits: AI adjust = 1 · AI generate = 3 · 4K export = 3</p>
        <p>Payments secured by Stripe, Binance Pay, and SSLCommerz.</p>
      </div>
    </div>
  );
}
