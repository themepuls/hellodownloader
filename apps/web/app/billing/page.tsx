'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bitcoin, CreditCard, Landmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';

type PaymentGateway = 'stripe' | 'binance' | 'sslcommerz';

export default function BillingPage() {
  const user = useUserStore((s) => s.user);
  const searchParams = useSearchParams();
  const [sub, setSub] = useState<Record<string, unknown> | null>(null);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState<PaymentGateway | null>(null);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get('success') === 'true';
  const sandbox = searchParams.get('sandbox') === 'true';
  const provider = searchParams.get('provider');

  useEffect(() => {
    if (!user) return;
    apiClient.billing.subscription().then((d) => setSub(d as Record<string, unknown> | null)).catch(() => null);
    apiClient.billing.payments().then((d) => setPayments(d as Array<Record<string, unknown>>)).catch(() => null);
  }, [user]);

  const checkout = async (gateway: PaymentGateway) => {
    setLoading(gateway);
    setError(null);
    try {
      if (gateway === 'stripe') {
        const res = (await apiClient.billing.checkout()) as { url: string };
        window.location.href = res.url;
      } else if (gateway === 'binance') {
        const res = (await apiClient.billing.binanceCheckout()) as { checkoutUrl: string };
        window.location.href = res.checkoutUrl;
      } else {
        const res = (await apiClient.billing.sslcommerzCheckout()) as { redirectUrl: string };
        window.location.href = res.redirectUrl;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p>
          Please <Link href="/login" className="text-primary underline">log in</Link> to manage billing.
        </p>
      </div>
    );
  }

  const isPro = user.plan === 'PRO';

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Billing</h1>

      {success && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Payment received{sandbox ? ' (sandbox — configure live keys for real checkout)' : ''}.
          {provider && ` Provider: ${provider}.`}
          {isPro ? ' Your Pro plan is active.' : ' Pro activates after webhook confirmation.'}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sub ? (
            <div className="text-sm space-y-1">
              <p>
                Plan: <strong>{String(sub.plan)}</strong> · {String(sub.status)}
              </p>
              <p className="text-muted-foreground">Provider: {String(sub.provider)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No active subscription.</p>
          )}
          <p className="text-sm">
            Current account: <strong>{user.plan}</strong> · {user.credits} credits
          </p>
        </CardContent>
      </Card>

      {!isPro && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle>Upgrade to Pro — $9.99/mo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full gap-2" disabled={loading !== null} onClick={() => checkout('stripe')}>
              {loading === 'stripe' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay with Stripe (USD)
            </Button>
            <Button variant="outline" className="w-full gap-2" disabled={loading !== null} onClick={() => checkout('binance')}>
              {loading === 'binance' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
              Pay with Binance Pay (USDT)
            </Button>
            <Button variant="outline" className="w-full gap-2" disabled={loading !== null} onClick={() => checkout('sslcommerz')}>
              {loading === 'sslcommerz' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
              Pay with SSLCommerz (৳1,099 BDT)
            </Button>
          </CardContent>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li key={String(p.id)} className="flex justify-between border-b border-white/5 pb-2">
                  <span>
                    {String(p.provider)} · {String(p.status)}
                  </span>
                  <span>
                    {String(p.currency)} {Number(p.amount).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
