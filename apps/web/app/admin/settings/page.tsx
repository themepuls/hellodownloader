'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  HD_QUALITY_TIERS,
  HD_QUALITY_TIER_LABELS,
  type HdQualityAccessConfig,
  type HdQualityTier,
  type QualityTierAccess,
} from '@hellodownloader/shared-types';

type Settings = {
  planLimits: Record<string, Record<string, unknown>>;
  creditCosts: Record<string, number>;
  retentionHours: number;
  downloadQualityAccess: HdQualityAccessConfig;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [retentionHours, setRetentionHours] = useState('1');
  const [qualityAccess, setQualityAccess] = useState<HdQualityAccessConfig>({
    1080: 'pro',
    1440: 'pro',
    2160: 'pro',
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    apiClient.admin.settings().then((d) => {
      const s = d as Settings;
      setSettings(s);
      setRetentionHours(String(s.retentionHours));
      setQualityAccess(s.downloadQualityAccess);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Record<string, unknown>) => {
    setMsg(null);
    try {
      await apiClient.admin.updateSettings(patch);
      setMsg('Settings saved');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const setTierAccess = (tier: HdQualityTier, access: QualityTierAccess) => {
    setQualityAccess((prev) => ({ ...prev, [tier]: access }));
  };

  if (!settings) return <AdminPageHeader title="Settings" description="Loading…" />;

  return (
    <>
      <AdminPageHeader title="Settings" description="Retention, HD download access, and plan limits" />

      <div className="space-y-6 max-w-2xl">
        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-1">HD &amp; 4K download access</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choose whether each resolution is free for everyone or requires Pro. Locked tiers show
            as &quot;Coming soon&quot; on the download page.
          </p>
          <div className="space-y-3">
            {HD_QUALITY_TIERS.map((tier) => (
              <div
                key={tier}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <span className="text-sm font-medium">{HD_QUALITY_TIER_LABELS[tier]}</span>
                <div className="flex gap-2">
                  {(['free', 'pro'] as const).map((access) => (
                    <button
                      key={access}
                      type="button"
                      onClick={() => setTierAccess(tier, access)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                        qualityAccess[tier] === access
                          ? access === 'free'
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                            : 'bg-primary/20 text-primary ring-1 ring-primary/40'
                          : 'bg-accent/50 text-muted-foreground hover:bg-white/10'
                      }`}
                    >
                      {access}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button
            className="mt-4"
            onClick={() => void save({ downloadQualityAccess: qualityAccess })}
          >
            Save quality access
          </Button>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">File retention</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Hours before unused files are removed from server (cleanup job).
          </p>
          <div className="flex gap-2">
            <Input type="number" min={1} max={168} value={retentionHours} onChange={(e) => setRetentionHours(e.target.value)} />
            <Button onClick={() => save({ retentionHours: parseInt(retentionHours, 10) || 1 })}>Save</Button>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-2">Ads</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Banner, popup, rewarded ads, and code from any ad network are configured on the dedicated
            Ads page.
          </p>
          <Link href="/admin/ads">
            <Button variant="outline" size="sm">
              Open Ads settings
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Plan limits (read-only)</h2>
          <p className="text-sm text-muted-foreground mb-3">Defined in code — edit shared-types to change permanently.</p>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-auto max-h-64">
            {JSON.stringify(settings.planLimits, null, 2)}
          </pre>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold mb-3">Credit costs</h2>
          <pre className="text-xs bg-black/30 rounded-lg p-3">{JSON.stringify(settings.creditCosts, null, 2)}</pre>
        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </>
  );
}
