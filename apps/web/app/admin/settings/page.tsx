'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Settings = {
  planLimits: Record<string, Record<string, unknown>>;
  creditCosts: Record<string, number>;
  ads: {
    bannerEnabled: boolean;
    popupEnabled: boolean;
    rewardedEnabled: boolean;
    creditsReward: number;
    popupDelayMs: number;
  };
  retentionHours: number;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [retentionHours, setRetentionHours] = useState('1');
  const [creditsReward, setCreditsReward] = useState('1');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    apiClient.admin.settings().then((d) => {
      const s = d as Settings;
      setSettings(s);
      setRetentionHours(String(s.retentionHours));
      setCreditsReward(String(s.ads.creditsReward));
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Record<string, unknown>) => {
    setMsg(null);
    try {
      await apiClient.admin.updateSettings(patch);
      setMsg('Settings saved (runtime — restart API for env-based values)');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  if (!settings) return <AdminPageHeader title="Settings" description="Loading…" />;

  return (
    <>
      <AdminPageHeader title="Settings" description="Plan limits, ads, and retention" />

      <div className="space-y-6 max-w-2xl">
        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-semibold mb-3">File retention</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Hours before unused files are removed from server (cleanup job).
          </p>
          <div className="flex gap-2">
            <Input type="number" min={1} max={168} value={retentionHours} onChange={(e) => setRetentionHours(e.target.value)} />
            <Button onClick={() => save({ retentionHours: parseInt(retentionHours, 10) || 1 })}>Save</Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-semibold mb-3">Ads (free users)</h2>
          <div className="space-y-2 text-sm mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ads.bannerEnabled}
                onChange={(e) => save({ ads: { bannerEnabled: e.target.checked } })}
              />
              Banner ads
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ads.popupEnabled}
                onChange={(e) => save({ ads: { popupEnabled: e.target.checked } })}
              />
              Popup ads
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.ads.rewardedEnabled}
                onChange={(e) => save({ ads: { rewardedEnabled: e.target.checked } })}
              />
              Rewarded ads
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm">Credits per rewarded ad:</span>
            <Input className="w-20" type="number" value={creditsReward} onChange={(e) => setCreditsReward(e.target.value)} />
            <Button size="sm" onClick={() => save({ ads: { creditsReward: parseInt(creditsReward, 10) || 1 } })}>
              Save
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-semibold mb-3">Plan limits (read-only)</h2>
          <p className="text-sm text-muted-foreground mb-3">Defined in code — edit shared-types to change permanently.</p>
          <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-auto max-h-64">
            {JSON.stringify(settings.planLimits, null, 2)}
          </pre>
        </div>

        <div className="rounded-xl border border-white/10 p-4">
          <h2 className="font-semibold mb-3">Credit costs</h2>
          <pre className="text-xs bg-black/30 rounded-lg p-3">{JSON.stringify(settings.creditCosts, null, 2)}</pre>
        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </>
  );
}
