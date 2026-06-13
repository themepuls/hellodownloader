'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { CustomAdsEditor } from '@/components/admin/ads/CustomAdsEditor';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToastStack, useToast } from '@/components/ui/toast';
import {
  DEFAULT_ADS_ADMIN_CONFIG,
  type AdsAdminConfig,
} from '@hellodownloader/shared-types';

type Tab = 'custom' | 'banner' | 'popup' | 'rewarded' | 'global' | 'affiliate';

const tabs: { id: Tab; label: string }[] = [
  { id: 'custom', label: 'Custom ads' },
  { id: 'banner', label: 'Network banner' },
  { id: 'popup', label: 'Popup' },
  { id: 'rewarded', label: 'Rewarded' },
  { id: 'global', label: 'Global' },
  { id: 'affiliate', label: 'Affiliate links' },
];

const SUPPORTED_NETWORKS =
  'Google AdSense, Media.net, PropellerAds, Adsterra, Ezoic, Taboola, Outbrain, Amazon, or any custom HTML/script/iframe code.';

export default function AdminAdsPage() {
  const { toasts, dismiss, error: toastError, success: toastSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('custom');
  const [config, setConfig] = useState<AdsAdminConfig>(DEFAULT_ADS_ADMIN_CONFIG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiClient.admin.getAds()) as AdsAdminConfig;
      setConfig({ ...DEFAULT_ADS_ADMIN_CONFIG, ...data });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load ads config');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (partial: Partial<AdsAdminConfig>) => {
    setConfig((c) => ({ ...c, ...partial }));
  };

  const save = async () => {
    if (config.customAdsEnabled && config.customAds.length === 0) {
      const ok = window.confirm(
        'No custom ads are configured. Saving now will clear any previously saved banners. Continue?',
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const data = (await apiClient.admin.updateAds(config)) as AdsAdminConfig;
      setConfig({ ...DEFAULT_ADS_ADMIN_CONFIG, ...data });
      toastSuccess('Ad settings saved');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading ad settings…
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Ads"
        description="Paste ad code from any network — scripts, iframes, and tags are supported automatically."
      />

      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Works with {SUPPORTED_NETWORKS} Copy the full code block from your ad dashboard and paste
            it below — no need to split HTML, CSS, or JS manually.
          </p>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h2 className="font-semibold">Enable ad types</h2>
          <p className="text-sm text-muted-foreground">
            Pro and admin users never see ads. Changes apply immediately after save.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <ToggleRow
              label="Banner ads"
              checked={config.bannerEnabled}
              onChange={(v) => patch({ bannerEnabled: v })}
            />
            <ToggleRow
              label="Popup ads"
              checked={config.popupEnabled}
              onChange={(v) => patch({ popupEnabled: v })}
            />
            <ToggleRow
              label="Rewarded ads"
              checked={config.rewardedEnabled}
              onChange={(v) => patch({ rewardedEnabled: v })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Popup delay (ms)">
              <input
                type="number"
                min={0}
                step={1000}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={config.popupDelayMs}
                onChange={(e) => patch({ popupDelayMs: parseInt(e.target.value, 10) || 0 })}
              />
            </Field>
            <Field label="Credits per rewarded ad (Pro — coming soon)">
              <input
                type="number"
                min={1}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={config.creditsReward}
                onChange={(e) => patch({ creditsReward: parseInt(e.target.value, 10) || 1 })}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
                  tab === t.id
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4">
            {tab === 'custom' && (
              <CustomAdsEditor
                enabled={config.customAdsEnabled}
                onEnabledChange={(customAdsEnabled) => patch({ customAdsEnabled })}
                bannerHeightPx={config.customAdsBannerHeightPx ?? 170}
                onBannerHeightPxChange={(customAdsBannerHeightPx) =>
                  patch({ customAdsBannerHeightPx })
                }
                items={config.customAds}
                onChange={(customAds) => patch({ customAds })}
              />
            )}
            {tab === 'banner' && (
              <SlotEditor
                slotId={config.bannerSlotId}
                onSlotId={(v) => patch({ bannerSlotId: v })}
                adTag={config.bannerAdTag}
                onAdTag={(v) => patch({ bannerAdTag: v })}
                html={config.bannerHtml}
                css={config.bannerCss}
                js={config.bannerJs}
                onHtml={(v) => patch({ bannerHtml: v })}
                onCss={(v) => patch({ bannerCss: v })}
                onJs={(v) => patch({ bannerJs: v })}
                hint="Shown on the download page under the URL bar."
              />
            )}
            {tab === 'popup' && (
              <SlotEditor
                slotId={config.popupSlotId}
                onSlotId={(v) => patch({ popupSlotId: v })}
                adTag={config.popupAdTag}
                onAdTag={(v) => patch({ popupAdTag: v })}
                html={config.popupHtml}
                css={config.popupCss}
                js={config.popupJs}
                onHtml={(v) => patch({ popupHtml: v })}
                onCss={(v) => patch({ popupCss: v })}
                onJs={(v) => patch({ popupJs: v })}
                hint="Shown site-wide after the popup delay (all pages, free users)."
              />
            )}
            {tab === 'rewarded' && (
              <SlotEditor
                slotId={config.rewardedSlotId}
                onSlotId={(v) => patch({ rewardedSlotId: v })}
                adTag={config.rewardedAdTag}
                onAdTag={(v) => patch({ rewardedAdTag: v })}
                html={config.rewardedHtml}
                css={config.rewardedCss}
                js={config.rewardedJs}
                onHtml={(v) => patch({ rewardedHtml: v })}
                onCss={(v) => patch({ rewardedCss: v })}
                onJs={(v) => patch({ rewardedJs: v })}
                hint="Rewarded ad code (UI hook coming soon — config is stored and exposed via API)."
              />
            )}
            {tab === 'global' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Site-wide code for free users — loader scripts, verification meta tags, or network
                  head snippets. Paste the full block from your ad network.
                </p>
                <CodeArea
                  label="Global ad code (any network)"
                  value={config.globalAdTag}
                  onChange={(v) => patch({ globalAdTag: v })}
                  rows={12}
                  placeholder={`<!-- Example: AdSense site-wide loader -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
<meta name="google-adsense-account" content="ca-pub-XXXX" />`}
                />
                <AdvancedFields title="Advanced: split global fields (optional)">
                  <CodeArea
                    label="Global CSS"
                    value={config.globalCss}
                    onChange={(v) => patch({ globalCss: v })}
                    rows={4}
                    placeholder=".ad-slot-html { text-align: center; }"
                  />
                  <CodeArea
                    label="Global head HTML"
                    value={config.globalHeadHtml}
                    onChange={(v) => patch({ globalHeadHtml: v })}
                    rows={3}
                    placeholder='<meta name="google-adsense-account" content="..." />'
                  />
                  <CodeArea
                    label="Global head JS (URL or inline)"
                    value={config.globalHeadJs}
                    onChange={(v) => patch({ globalHeadJs: v })}
                    rows={4}
                    placeholder="https://cdn.example.com/ad-loader.js"
                  />
                </AdvancedFields>
              </>
            )}
            {tab === 'affiliate' && (
              <>
                <p className="text-sm text-muted-foreground">
                  When a free user clicks a download or save button, the file download starts and your
                  affiliate link opens in a new tab. The current page is not reloaded. Pro and admin
                  users are skipped. URLs without <code className="text-xs">https://</code> get it added
                  automatically on save.
                </p>
                <ToggleRow
                  label="Enable affiliate links on save"
                  checked={config.affiliateLinksEnabled}
                  onChange={(affiliateLinksEnabled) => patch({ affiliateLinksEnabled })}
                />
                <div className="space-y-4 pt-2">
                  <Field label="Video download — Video tab (/download)">
                    <input
                      type="url"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={config.affiliateLinkDownload}
                      onChange={(e) => patch({ affiliateLinkDownload: e.target.value })}
                      placeholder="google.com or https://example.com/offer"
                    />
                  </Field>
                  <Field label="Audio download — MP3 tab (/download)">
                    <input
                      type="url"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={config.affiliateLinkAudio}
                      onChange={(e) => patch({ affiliateLinkAudio: e.target.value })}
                      placeholder="spotify.com or https://example.com/audio-offer"
                    />
                  </Field>
                  <Field label="Subtitle download — Subtitles tab (/download)">
                    <input
                      type="url"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={config.affiliateLinkSubtitle}
                      onChange={(e) => patch({ affiliateLinkSubtitle: e.target.value })}
                      placeholder="example.com or https://example.com/subtitle-offer"
                    />
                  </Field>
                  <Field label="Thumbnail download page (/thumbnail)">
                    <input
                      type="url"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={config.affiliateLinkThumbnail}
                      onChange={(e) => patch({ affiliateLinkThumbnail: e.target.value })}
                      placeholder="fb.com or https://example.com/thumbnail"
                    />
                  </Field>
                  <Field label="Playlist download page (/playlist)">
                    <input
                      type="url"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={config.affiliateLinkPlaylist}
                      onChange={(e) => patch({ affiliateLinkPlaylist: e.target.value })}
                      placeholder="youtube.com or https://example.com/playlist"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save ad settings
        </Button>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CodeArea({
  label,
  value,
  onChange,
  rows = 8,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

function AdvancedFields({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open ? <div className="space-y-4 border-t border-border p-4">{children}</div> : null}
    </div>
  );
}

function SlotEditor({
  slotId,
  onSlotId,
  adTag,
  onAdTag,
  html,
  css,
  js,
  onHtml,
  onCss,
  onJs,
  hint,
}: {
  slotId: string;
  onSlotId: (v: string) => void;
  adTag: string;
  onAdTag: (v: string) => void;
  html: string;
  css: string;
  js: string;
  onHtml: (v: string) => void;
  onCss: (v: string) => void;
  onJs: (v: string) => void;
  hint: string;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Field label="Slot ID (for your reference)">
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          value={slotId}
          onChange={(e) => onSlotId(e.target.value)}
          placeholder="banner-1"
        />
      </Field>
      <CodeArea
        label="Ad code — paste full snippet from your network"
        value={adTag}
        onChange={onAdTag}
        rows={14}
        placeholder={`<!-- Paste everything your ad network gives you -->
<script async src="https://cdn.example.com/ad.js"></script>
<div id="ad-unit-123"></div>
<script>/* init call */</script>

<!-- Or an iframe -->
<iframe src="https://ads.example.com/zone/123" width="728" height="90"></iframe>`}
      />
      <AdvancedFields title="Advanced: split HTML / CSS / JS (optional fallback)">
        <CodeArea label="HTML" value={html} onChange={onHtml} rows={5} />
        <CodeArea label="CSS" value={css} onChange={onCss} rows={4} />
        <CodeArea label="JavaScript" value={js} onChange={onJs} rows={4} />
        <p className="text-xs text-muted-foreground">
          Used only when the main ad code box above is empty.
        </p>
      </AdvancedFields>
    </>
  );
}
