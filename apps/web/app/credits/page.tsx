'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';

export default function CreditsPage() {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Array<{ reason: string; amount: number; balance: number; createdAt: string }>>([]);

  useEffect(() => {
    apiClient.credits.balance().then((b) => setBalance((b as { credits: number }).credits));
    apiClient.credits.history().then((h) => setHistory(h as typeof history));
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Credits</h1>
      <Card className="mb-6">
        <CardHeader><CardTitle>Balance</CardTitle></CardHeader>
        <CardContent><p className="text-4xl font-bold text-primary">{balance}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Usage History</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between border-b pb-2">
                <span>{h.reason}</span>
                <span className={h.amount < 0 ? 'text-destructive' : 'text-green-600'}>
                  {h.amount > 0 ? '+' : ''}{h.amount} → {h.balance}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
