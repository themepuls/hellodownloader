'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader, StatCard } from '@/components/admin/AdminShell';
import { SecretKeyInput } from '@/components/admin/api-settings/SecretKeyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToastStack, useToast } from '@/components/ui/toast';
import {
  DEFAULT_STORAGE_SETTINGS,
  isInvalidR2SecretValue,
  isValidR2AccountId,
  normalizeR2AccountId,
  toStorageSettingsAdmin,
  type StorageSettingsAdmin,
} from '@hellodownloader/shared-types';

type Storage = {
  basePath: string;
  totalMb: number;
  totalFiles: number;
  retentionHours: number;
  breakdown: Record<string, { files: number; bytes: number }>;
};

type System = {
  nodeVersion: string;
  redisEnabled: boolean;
  redisConnected: boolean;
  inlineDownloads: boolean;
  fileRetentionHours: number;
  deleteAfterDownload: boolean;
  uptimeSeconds: number;
};

export default function AdminStoragePage() {
  const { toasts, dismiss, error: toastError, success: toastSuccess } = useToast();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [system, setSystem] = useState<System | null>(null);
  const [config, setConfig] = useState<StorageSettingsAdmin | null>(null);
  const [secretInput, setSecretInput] = useState('');
  const [hours, setHours] = useState('1');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const load = useCallback(() => {
    setConfigLoading(true);
    setConfigError(null);
    apiClient.admin
      .storage()
      .then((d) => setStorage(d as Storage))
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load storage stats';
        setConfigError(message);
        toastError(message);
      });
    apiClient.admin
      .system()
      .then((d) => setSystem(d as System))
      .catch(() => setSystem(null));
    apiClient.admin
      .getStorageSettings()
      .then((d) => {
        const settings = d as StorageSettingsAdmin;
        setConfig(settings);
        setSecretInput(settings.r2SecretAccessKeyMasked || '');
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Failed to load storage settings';
        setConfigError(message);
        setConfig(toStorageSettingsAdmin(DEFAULT_STORAGE_SETTINGS));
        setSecretInput('');
        toastError(message);
      })
      .finally(() => setConfigLoading(false));
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (partial: Partial<StorageSettingsAdmin>) => {
    setConfig((c) => (c ? { ...c, ...partial } : c));
  };

  const buildPayload = (): Record<string, unknown> | null => {
    if (!config) return null;
    const accountId = normalizeR2AccountId(config.r2AccountId);
    if (!isValidR2AccountId(accountId)) {
      toastError('Account ID must be the 32-character hex from Cloudflare → R2 → Account ID.');
      return null;
    }
    if (
      secretInput.trim() &&
      !secretInput.includes('•') &&
      isInvalidR2SecretValue(secretInput)
    ) {
      toastError('Secret Access Key must be the token secret — not the R2 endpoint URL.');
      return null;
    }
    const payload: Record<string, unknown> = {
      r2Enabled: config.r2Enabled,
      r2AccountId: accountId,
      r2AccessKeyId: config.r2AccessKeyId.trim(),
      r2BucketName: config.r2BucketName.trim(),
      r2PublicUrl: config.r2PublicUrl.trim(),
      videoRetentionHours: config.videoRetentionHours,
      thumbnailRetentionDays: config.thumbnailRetentionDays,
    };
    if (secretInput.trim() && !secretInput.includes('•')) {
      payload.r2SecretAccessKey = secretInput.trim();
    }
    return payload;
  };

  const saveSettings = async () => {
    if (!config) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const data = (await apiClient.admin.updateStorageSettings(payload)) as StorageSettingsAdmin;
      setConfig(data);
      setSecretInput(data.r2SecretAccessKeyMasked || '');
      toastSuccess('Cloudflare R2 settings saved');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const testR2 = async () => {
    setTesting(true);
    try {
      const payload = buildPayload();
      if (!payload) return;
      if (!payload.r2SecretAccessKey && !config?.hasR2SecretAccessKey) {
        toastError('Enter the Secret Access Key from your R2 API token, then test again.');
        return;
      }
      await apiClient.admin.updateStorageSettings(payload);
      const res = await apiClient.admin.testStorageR2();
      if (res.ok) toastSuccess(res.message);
      else toastError(res.message);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const runCleanup = async () => {
    setMsg(null);
    try {
      const res = (await apiClient.admin.cleanup(parseInt(hours, 10) || 1)) as { removed: number };
      setMsg(`Removed ${res.removed} files`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Cleanup failed');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Storage & system"
        description="Local disk usage, Cloudflare R2, and retention"
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total storage"
          value={storage ? `${storage.totalMb} MB` : '—'}
          sub={`${storage?.totalFiles ?? 0} files`}
        />
        <StatCard label="Retention" value={storage ? `${storage.retentionHours}h` : '—'} />
        <StatCard label="Uptime" value={system ? `${Math.floor(system.uptimeSeconds / 3600)}h` : '—'} />
      </div>

      <div className="rounded-xl border border-border p-4 mb-8 space-y-5 max-w-2xl">
        <div>
          <h2 className="font-semibold text-lg">Cloudflare R2</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Store videos and thumbnails on Cloudflare instead of filling your server disk. Create a
            bucket in{' '}
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Cloudflare R2
            </a>
            , then paste API credentials below.
          </p>
        </div>

        {configLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading R2 settings…
          </div>
        ) : config ? (
          <>
            {configError && (
              <p className="text-sm text-amber-700 dark:text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                {configError} — showing defaults. Restart the API server if you just updated the
                app, then refresh.
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Enable Cloudflare R2</p>
                <p className="text-xs text-muted-foreground">
                  When off, files stay on local disk under {storage?.basePath ?? 'storage/'}
                </p>
              </div>
              <Switch
                checked={config.r2Enabled}
                onCheckedChange={(checked) => patch({ r2Enabled: checked })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Account ID</Label>
              <Input
                value={config.r2AccountId}
                onChange={(e) => patch({ r2AccountId: e.target.value })}
                placeholder="Cloudflare account ID"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Cloudflare dashboard → R2 → copy <strong>Account ID</strong> (32-character hex). Not
                the endpoint URL.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Access Key ID</Label>
              <Input
                value={config.r2AccessKeyId}
                onChange={(e) => patch({ r2AccessKeyId: e.target.value })}
                placeholder="R2 access key ID"
                className="font-mono text-sm"
              />
            </div>

            <SecretKeyInput
              label="Secret Access Key"
              value={secretInput}
              onChange={setSecretInput}
              placeholder="R2 secret access key"
              hint="Paste the secret shown once when you create the R2 API token — not the endpoint URL."
              configured={config.hasR2SecretAccessKey}
            />

            <div className="space-y-1.5">
              <Label>Bucket name</Label>
              <Input
                value={config.r2BucketName}
                onChange={(e) => patch({ r2BucketName: e.target.value })}
                placeholder={DEFAULT_STORAGE_SETTINGS.bucketName}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Public URL (optional)</Label>
              <Input
                value={config.r2PublicUrl}
                onChange={(e) => patch({ r2PublicUrl: e.target.value })}
                placeholder="https://pub-xxxxx.r2.dev"
              />
              <p className="text-xs text-muted-foreground">
                R2 public bucket URL or custom domain for direct file links.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label>Video retention (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={config.videoRetentionHours}
                  onChange={(e) =>
                    patch({ videoRetentionHours: parseInt(e.target.value, 10) || 1 })
                  }
                />
                <p className="text-xs text-muted-foreground">Default: 1 hour on R2 / local cleanup</p>
              </div>
              <div className="space-y-1.5">
                <Label>Thumbnail retention (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.thumbnailRetentionDays}
                  onChange={(e) =>
                    patch({ thumbnailRetentionDays: parseInt(e.target.value, 10) || 30 })
                  }
                />
                <p className="text-xs text-muted-foreground">Default: 30 days</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveSettings()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save R2 settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void testR2()}
                disabled={testing || !config.r2Enabled}
                className="gap-2"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Test connection
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Environment variables (<code>R2_*</code>) override admin settings when set. Upload
              pipeline to R2 after each download is configured separately — keys here prepare storage.
            </p>
          </>
        ) : null}
      </div>

      {storage && (
        <div className="rounded-xl border border-border p-4 mb-8">
          <h2 className="font-semibold mb-3">Local disk breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {Object.entries(storage.breakdown).map(([dir, s]) => (
              <div key={dir} className="rounded-lg bg-accent/50 p-3">
                <div className="font-medium capitalize">{dir}</div>
                <div className="text-muted-foreground text-xs">
                  {s.files} files · {(s.bytes / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Path: {storage.basePath}</p>
        </div>
      )}

      <div className="rounded-xl border border-border p-4 mb-8">
        <h2 className="font-semibold mb-3">Run cleanup now</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Delete local files older than retention from downloads, playlists, temp, and thumbnails.
        </p>
        <div className="flex gap-2 max-w-xs">
          <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
          <Button onClick={() => void runCleanup()}>Cleanup</Button>
        </div>
        {msg && <p className="text-sm mt-2 text-muted-foreground">{msg}</p>}
      </div>

      {system && (
        <div className="rounded-xl border border-border p-4 text-sm space-y-2">
          <h2 className="font-semibold mb-2">System</h2>
          <p>Node: {system.nodeVersion}</p>
          <p>
            Redis queue:{' '}
            {system.redisEnabled
              ? system.redisConnected
                ? 'Connected'
                : 'Disabled/fallback'
              : 'Off (inline mode)'}
          </p>
          <p>Inline downloads: {system.inlineDownloads ? 'Yes' : 'No'}</p>
          <p>Delete after save: {system.deleteAfterDownload ? 'Yes' : 'No'}</p>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
