'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

export default function BillingPage() {
  const [sub, setSub] = useState<unknown>(null);

  useEffect(() => {
    apiClient.billing.subscription().then(setSub).catch(() => null);
  }, []);

  const upgrade = async () => {
    const { url } = await apiClient.billing.checkout() as { url: string };
    window.location.href = url;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Billing</h1>
      <Card>
        <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {sub ? (
            <pre className="text-sm bg-muted p-4 rounded">{JSON.stringify(sub, null, 2)}</pre>
          ) : (
            <p className="text-muted-foreground">No active subscription.</p>
          )}
          <Button onClick={upgrade}>Manage / Upgrade via Stripe</Button>
        </CardContent>
      </Card>
    </div>
  );
}
