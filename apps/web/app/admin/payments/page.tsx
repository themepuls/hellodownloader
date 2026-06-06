'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  Bitcoin,
  Landmark,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Settings2,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, PaginationBar, StatCard, StatusBadge } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProviderId = 'STRIPE' | 'BINANCE' | 'SSLCOMMERZ';

type PaymentMethod = {
  id: ProviderId;
  name: string;
  description: string;
  currency: string;
  amount: number;
  enabled: boolean;
  mode: 'TEST' | 'LIVE';
  configured: boolean;
  webhookUrl: string;
  stats: {
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    revenue: number;
  };
};

type ProviderConfig = {
  provider: ProviderId;
  enabled: boolean;
  mode: 'TEST' | 'LIVE';
  amount: number;
  currency: string;
  configured: boolean;
  secrets: Record<string, string | boolean>;
};

type Overview = {
  webOrigin: string;
  pendingPayments: number;
  byStatus: Record<string, number>;
  methods: PaymentMethod[];
};

const icons = {
  STRIPE: CreditCard,
  BINANCE: Bitcoin,
  SSLCOMMERZ: Landmark,
};

function formatAmount(currency: string, amount: number) {
  const formatted =
    Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(2);
  return `${formatted} ${currency}`;
}

function ConfigModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: ProviderId;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'TEST' | 'LIVE'>('TEST');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [secrets, setSecrets] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    apiClient.admin
      .paymentConfigs()
      .then((rows) => {
        const row = (rows as ProviderConfig[]).find((r) => r.provider === provider);
        if (!row) return;
        setEnabled(row.enabled);
        setMode(row.mode);
        setAmount(String(row.amount));
        setCurrency(row.currency);
        const s = row.secrets as Record<string, string | boolean>;
        const initial: Record<string, string> = {};
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === 'string' && !k.startsWith('has')) initial[k] = v;
        }
        setSecrets(initial);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => setLoading(false));
  }, [provider]);

  const setSecret = (key: string, value: string) => {
    setSecrets((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.admin.updatePaymentConfig(provider, {
        enabled,
        mode,
        amount: parseFloat(amount),
        currency: currency.trim().toUpperCase(),
        secrets,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const labels: Record<ProviderId, { title: string; test: string[]; live: string[] }> = {
    STRIPE: {
      title: 'Stripe',
      test: ['testSecretKey', 'testWebhookSecret', 'testPriceId'],
      live: ['liveSecretKey', 'liveWebhookSecret', 'livePriceId'],
    },
    BINANCE: {
      title: 'Binance Pay',
      test: ['testApiKey', 'testSecretKey'],
      live: ['liveApiKey', 'liveSecretKey'],
    },
    SSLCOMMERZ: {
      title: 'SSLCommerz',
      test: ['testStoreId', 'testStorePass'],
      live: ['liveStoreId', 'liveStorePass'],
    },
  };

  const fieldLabel = (key: string) =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  const isPassword = (key: string) =>
    key.toLowerCase().includes('secret') ||
    key.toLowerCase().includes('pass') ||
    key.toLowerCase().includes('passwd');

  const cfg = labels[provider];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Configure {cfg.title}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded"
                />
                Enabled for checkout
              </label>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Active mode</p>
              <div className="flex gap-2">
                {(['TEST', 'LIVE'] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={mode === m ? 'default' : 'outline'}
                    onClick={() => setMode(m)}
                  >
                    {m === 'TEST' ? 'Test / Sandbox' : 'Live'}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Checkout uses credentials for the selected mode.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="USD, USDT, BDT…"
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Test credentials</p>
              {cfg.test.map((key) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{fieldLabel(key)}</label>
                  <Input
                    type={isPassword(key) ? 'password' : 'text'}
                    value={secrets[key] ?? ''}
                    onChange={(e) => setSecret(key, e.target.value)}
                    placeholder={isPassword(key) ? 'Leave blank to keep existing' : ''}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Live credentials</p>
              {cfg.live.map((key) => (
                <div key={key}>
                  <label className="text-xs text-muted-foreground">{fieldLabel(key)}</label>
                  <Input
                    type={isPassword(key) ? 'password' : 'text'}
                    value={secrets[key] ?? ''}
                    onChange={(e) => setSecret(key, e.target.value)}
                    placeholder={isPassword(key) ? 'Leave blank to keep existing' : ''}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save configuration'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<'methods' | 'transactions' | 'subscriptions'>('methods');
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [payments, setPayments] = useState<{ items: Array<Record<string, unknown>>; page: number; pages: number } | null>(null);
  const [subs, setSubs] = useState<{ items: Array<Record<string, unknown>>; page: number; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<ProviderId | null>(null);

  const loadOverview = useCallback(() => {
    apiClient.admin
      .paymentsOverview()
      .then((d) => setOverview(d as Overview))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  const loadTransactions = useCallback(() => {
    apiClient.admin
      .listPayments({ page, provider: provider || undefined, status: status || undefined })
      .then((d) => setPayments(d as typeof payments));
  }, [page, provider, status]);

  const loadSubs = useCallback(() => {
    apiClient.admin.listSubscriptions({ page }).then((d) => setSubs(d as typeof subs));
  }, [page]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 'transactions') loadTransactions();
    if (tab === 'subscriptions') loadSubs();
  }, [tab, loadTransactions, loadSubs]);

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Configure Stripe, Binance Pay, and SSLCommerz from this panel"
      />
      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        {(['methods', 'transactions', 'subscriptions'] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {t === 'methods' ? 'Payment methods' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {tab === 'methods' && overview && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Pending payments" value={overview.pendingPayments} />
            <StatCard label="Completed" value={overview.byStatus.COMPLETED ?? 0} />
            <StatCard label="Failed / refunded" value={(overview.byStatus.FAILED ?? 0) + (overview.byStatus.REFUNDED ?? 0)} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {overview.methods.map((method) => {
              const Icon = icons[method.id];
              return (
                <div
                  key={method.id}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/15 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{method.name}</h3>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </div>
                    {method.configured && method.enabled ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {!method.configured ? 'Not configured' : 'Disabled'}
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-bold">
                    {formatAmount(method.currency, method.amount)}
                    <span className="text-sm font-normal text-muted-foreground"> / month</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Mode: {method.mode === 'LIVE' ? 'Live' : 'Test / Sandbox'}
                    {method.id === 'SSLCOMMERZ' && ' · Bangladesh'}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-accent/50 p-2">
                      <div className="font-semibold">{method.stats.completedCount}</div>
                      <div className="text-muted-foreground">Done</div>
                    </div>
                    <div className="rounded-lg bg-accent/50 p-2">
                      <div className="font-semibold">{method.stats.pendingCount}</div>
                      <div className="text-muted-foreground">Pending</div>
                    </div>
                    <div className="rounded-lg bg-accent/50 p-2">
                      <div className="font-semibold">{method.stats.failedCount}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 mt-auto border-t border-border pt-3">
                    <p className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Webhook: <code className="text-[10px]">{method.webhookUrl}</code>
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setConfiguring(method.id)}
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Success redirect base URL: <span className="text-foreground">{overview.webOrigin}</span>
            <span className="block mt-1">
              Set via server env on deploy — <code className="text-[11px]">CORS_ORIGIN</code> or{' '}
              <code className="text-[11px]">WEB_URL</code> (e.g.{' '}
              <code className="text-[11px]">https://hellodownloader.com</code>). Localhost is dev-only.
            </span>
          </p>
        </>
      )}

      {configuring && (
        <ConfigModal
          provider={configuring}
          onClose={() => setConfiguring(null)}
          onSaved={loadOverview}
        />
      )}

      {tab === 'transactions' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All providers</option>
              <option value="STRIPE">Stripe</option>
              <option value="BINANCE">Binance Pay</option>
              <option value="SSLCOMMERZ">SSLCommerz</option>
            </select>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-accent/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No payments yet. They appear when users checkout via Stripe, Binance, or SSLCommerz.
                    </td>
                  </tr>
                )}
                {payments?.items.map((p) => {
                  const user = p.user as { email: string };
                  const providerLabel =
                    p.provider === 'STRIPE'
                      ? 'Stripe'
                      : p.provider === 'BINANCE'
                        ? 'Binance Pay'
                        : 'SSLCommerz';
                  return (
                    <tr key={String(p.id)} className="border-t border-border/60">
                      <td className="p-3 text-xs">{user?.email ?? '—'}</td>
                      <td className="p-3">{providerLabel}</td>
                      <td className="p-3">
                        {formatAmount(String(p.currency), Number(p.amount))}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[120px] truncate" title={String(p.providerRef ?? '')}>
                        {String(p.providerRef ?? '—')}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={String(p.status)} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(String(p.createdAt)).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payments && <PaginationBar page={payments.page} pages={payments.pages} onPage={setPage} />}
        </>
      )}

      {tab === 'subscriptions' && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-accent/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Period end</th>
                </tr>
              </thead>
              <tbody>
                {subs?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No subscriptions yet.
                    </td>
                  </tr>
                )}
                {subs?.items.map((s) => {
                  const user = s.user as { email: string };
                  const providerLabel =
                    s.provider === 'STRIPE'
                      ? 'Stripe'
                      : s.provider === 'BINANCE'
                        ? 'Binance Pay'
                        : 'SSLCommerz';
                  return (
                    <tr key={String(s.id)} className="border-t border-border/60">
                      <td className="p-3 text-xs">{user?.email}</td>
                      <td className="p-3">{String(s.plan)}</td>
                      <td className="p-3">{providerLabel}</td>
                      <td className="p-3">
                        <StatusBadge status={String(s.status)} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {s.currentPeriodEnd
                          ? new Date(String(s.currentPeriodEnd)).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {subs && <PaginationBar page={subs.page} pages={subs.pages} onPage={setPage} />}
        </>
      )}
    </>
  );
}
