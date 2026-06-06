'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import { usePageContent } from '@/hooks/usePageContent';
import { DEFAULT_PRICING_CONTENT, type PricingPageContent } from '@hellodownloader/shared-types';

type PaymentGateway = 'stripe' | 'binance' | 'sslcommerz';

type PaymentMethods = {
  stripe: boolean;
  binance: boolean;
  sslcommerz: boolean;
  anyEnabled: boolean;
};

export default function PricingPage() {
  const user = useUserStore((s) => s.user);
  const content = usePageContent<PricingPageContent>('pricing', DEFAULT_PRICING_CONTENT);
  const [loading, setLoading] = useState<PaymentGateway | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);

  useEffect(() => {
    apiClient.billing
      .paymentMethods()
      .then(setPaymentMethods)
      .catch(() =>
        setPaymentMethods({ stripe: false, binance: false, sslcommerz: false, anyEnabled: false }),
      );
  }, []);

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
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">{content.header.title}</h1>
        <p className="text-muted-foreground text-lg">{content.header.subtitle}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{content.free.title}</CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              {content.free.price} {content.free.priceSuffix}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              {content.free.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" disabled={!user || isPro}>
              {!user ? content.free.buttonText : isPro ? 'Included in Pro' : 'Current Plan'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {content.pro.title}
              {isPro && (
                <span className="text-xs font-normal bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-3xl font-bold text-foreground">
              {content.pro.price} {content.pro.priceSuffix}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 mb-6">
              {content.pro.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            {!isPro && (
              <div className="space-y-2">
                {!paymentMethods ? null : !paymentMethods.anyEnabled ? (
                  <Button className="w-full" disabled>
                    Coming soon
                  </Button>
                ) : (
                  <>
                    {paymentMethods.stripe && (
                      <Button className="w-full" onClick={() => handleUpgrade('stripe')} disabled={loading !== null}>
                        {loading === 'stripe' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Pay with Stripe
                      </Button>
                    )}
                    {paymentMethods.binance && (
                      <Button variant="outline" className="w-full" onClick={() => handleUpgrade('binance')} disabled={loading !== null}>
                        {loading === 'binance' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Pay with Binance Pay (USDT)
                      </Button>
                    )}
                    {paymentMethods.sslcommerz && (
                      <Button variant="outline" className="w-full" onClick={() => handleUpgrade('sslcommerz')} disabled={loading !== null}>
                        {loading === 'sslcommerz' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Pay with SSLCommerz (BDT)
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            {isPro && <Button variant="outline" className="w-full" disabled>You are on Pro</Button>}
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-10 text-sm text-muted-foreground space-y-1">
        <p>{content.footer.line1}</p>
        <p>{content.footer.line2}</p>
      </div>
    </div>
  );
}
