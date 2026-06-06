'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToastStack, useToast } from '@/components/ui/toast';
import { ImageUploadField } from '@/components/admin/content/ImageUploadField';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettingsAdmin,
  type VerificationFile,
} from '@hellodownloader/shared-types';

type Tab = 'seo' | 'code' | 'verification' | 'routes' | 'auth';

const tabs: { id: Tab; label: string }[] = [
  { id: 'seo', label: 'Global SEO' },
  { id: 'code', label: 'Custom code' },
  { id: 'verification', label: 'Verification' },
  { id: 'routes', label: 'Route SEO' },
  { id: 'auth', label: 'Authentication' },
];

const ROUTE_KEYS = ['playlist', 'login', 'register', 'dashboard', 'blog'] as const;

export default function AdminSiteSettingsPage() {
  const { toasts, dismiss, error: toastError, success: toastSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('seo');
  const [config, setConfig] = useState<SiteSettingsAdmin>(() => normalizeSiteSettings());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiClient.admin.getSiteSettings()) as SiteSettingsAdmin;
      setConfig(normalizeSiteSettings(data));
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load site settings');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (partial: Partial<SiteSettingsAdmin>) => {
    setConfig((c) => normalizeSiteSettings({ ...c, ...partial }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = (await apiClient.admin.updateSiteSettings(config)) as SiteSettingsAdmin;
      setConfig(normalizeSiteSettings(data));
      toastSuccess('Site settings saved');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateVerificationFile = (index: number, filePatch: Partial<VerificationFile>) => {
    const next = [...config.verificationFiles];
    next[index] = { ...next[index]!, ...filePatch };
    patch({ verificationFiles: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading site settings…
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Site Settings"
        description="Global SEO, custom CSS/JS, search console verification, and scripts for analytics or tags."
      />

      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
          <p>
            Use <strong>Global SEO</strong> for site-wide defaults. Per-page SEO is edited in{' '}
            <strong>Content</strong> for each built-in page. Custom CSS/JS runs on every public page
            (separate from Ads).
          </p>
          <p className="mt-2">
            Note: This app runs on Next.js — PHP files cannot execute here. Use HTML verification
            files, meta tags, or JavaScript snippets instead.
          </p>
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
            {tab === 'seo' && (
              <>
                <p className="text-xs text-muted-foreground rounded-lg border border-border px-3 py-2">
                  Sitemap: <code>/sitemap.xml</code> · Robots: <code>/robots.txt</code> — auto-generated
                  from published Content pages. Pages with &quot;noindex&quot; are excluded.
                </p>
                <Field label="Site name" value={config.siteName} onChange={(v) => patch({ siteName: v })} />
                <Field
                  label="Site URL (https://yoursite.com)"
                  value={config.siteUrl}
                  onChange={(v) => patch({ siteUrl: v })}
                />
                <Field
                  label="Title template (%s = page title)"
                  value={config.titleTemplate}
                  onChange={(v) => patch({ titleTemplate: v })}
                />
                <Field
                  label="Default meta title"
                  value={config.defaultMetaTitle}
                  onChange={(v) => patch({ defaultMetaTitle: v })}
                />
                <TextArea
                  label="Default meta description"
                  value={config.defaultMetaDescription}
                  onChange={(v) => patch({ defaultMetaDescription: v })}
                  rows={3}
                />
                <Field
                  label="Default keywords (comma-separated)"
                  value={config.defaultKeywords}
                  onChange={(v) => patch({ defaultKeywords: v })}
                />
                <ImageUploadField
                  label="Favicon"
                  hint="Browser tab icon. PNG or ICO recommended (32×32 or 64×64)."
                  value={config.faviconUrl}
                  onChange={(v) => patch({ faviconUrl: v })}
                  accept="image/png,image/jpeg,image/webp,image/x-icon,.ico"
                  previewClassName="h-8 w-8"
                />
                <ImageUploadField
                  label="Default social share image (Open Graph)"
                  hint="Preview image when your link is shared on Facebook, Twitter/X, LinkedIn, Discord, etc. Recommended 1200×630 PNG or JPG."
                  value={config.defaultOgImage}
                  onChange={(v) => patch({ defaultOgImage: v })}
                  accept="image/png,image/jpeg,image/webp"
                  previewClassName="h-16 w-28"
                />
              </>
            )}

            {tab === 'code' && (
              <>
                <p className="text-xs text-muted-foreground rounded-lg border border-border px-3 py-2">
                  Paste full code blocks from any service — HTML with <code>&lt;script&gt;</code> tags,
                  Google Analytics, Tag Manager, meta tags, and <code>&lt;style&gt;</code> blocks all work.
                  Scripts are extracted and executed automatically.
                </p>
                <TextArea
                  label="Custom head snippet"
                  hint="Full head code: meta tags, script tags, GTM, Analytics, etc."
                  value={config.customHeadSnippet}
                  onChange={(v) => patch({ customHeadSnippet: v })}
                  rows={10}
                />
                <TextArea
                  label="Additional head HTML / JS"
                  hint="More head code — supports HTML mixed with inline or external script tags."
                  value={config.globalHeadHtml}
                  onChange={(v) => patch({ globalHeadHtml: v })}
                  rows={6}
                />
                <TextArea
                  label="Head JavaScript only (optional)"
                  hint="Plain JS code or a script URL — use only if not already inside the HTML fields above."
                  value={config.globalHeadJs}
                  onChange={(v) => patch({ globalHeadJs: v })}
                  rows={4}
                />
                <TextArea
                  label="Global CSS"
                  value={config.globalCss}
                  onChange={(v) => patch({ globalCss: v })}
                  rows={6}
                />
                <TextArea
                  label="Body HTML / JS (before footer)"
                  hint="Body scripts or HTML — paste full blocks with script tags, or plain JS / script URL."
                  value={config.globalBodyJs}
                  onChange={(v) => patch({ globalBodyJs: v })}
                  rows={6}
                />
              </>
            )}

            {tab === 'verification' && (
              <>
                <Field
                  label="Google Search Console (content value)"
                  value={config.googleSiteVerification}
                  onChange={(v) => patch({ googleSiteVerification: v })}
                  placeholder="abc123..."
                />
                <Field
                  label="Bing Webmaster (msvalidate.01 content)"
                  value={config.bingSiteVerification}
                  onChange={(v) => patch({ bingSiteVerification: v })}
                />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>HTML verification files</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patch({
                          verificationFiles: [
                            ...config.verificationFiles,
                            { filename: 'google1234567890.html', content: 'google-site-verification: google1234567890.html' },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add file
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Served at <code>/filename.html</code> on your site (e.g. Google HTML file upload).
                  </p>
                  {config.verificationFiles.map((file, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <Field
                        label="Filename"
                        value={file.filename}
                        onChange={(v) => updateVerificationFile(i, { filename: v })}
                      />
                      <TextArea
                        label="File content"
                        value={file.content}
                        onChange={(v) => updateVerificationFile(i, { content: v })}
                        rows={3}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          patch({ verificationFiles: config.verificationFiles.filter((_, j) => j !== i) })
                        }
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'auth' && (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                  <p>
                    Enable &quot;Sign in with Google&quot; on the login and register pages. Create OAuth
                    credentials in{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Google Cloud Console
                    </a>{' '}
                    (Web application type).
                  </p>
                  <p>
                    Add authorized JavaScript origins:{' '}
                    <code className="text-xs">{config.siteUrl || 'https://your-domain.com'}</code>{' '}
                    and <code className="text-xs">http://localhost:3000</code> for local dev.
                  </p>
                  <p>
                    Environment variables <code>GOOGLE_CLIENT_ID</code> /{' '}
                    <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> override these settings when set.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Enable Google sign-in</p>
                    <p className="text-xs text-muted-foreground">
                      Shows Google button on login and register pages
                    </p>
                  </div>
                  <Switch
                    checked={config.googleAuthEnabled}
                    onCheckedChange={(checked) => patch({ googleAuthEnabled: checked })}
                  />
                </div>

                <Field
                  label="Google OAuth Client ID"
                  value={config.googleClientId}
                  onChange={(v) => patch({ googleClientId: v })}
                  placeholder="123456789-abc.apps.googleusercontent.com"
                />
              </>
            )}

            {tab === 'routes' && (
              <>
                <p className="text-sm text-muted-foreground">
                  SEO for routes without a Content page entry (playlist, auth pages, etc.).
                </p>
                {ROUTE_KEYS.map((key) => {
                  const routeSeo = config.routeSeo[key] ?? {};
                  return (
                    <div key={key} className="rounded-lg border border-border p-4 space-y-2">
                      <p className="text-sm font-medium capitalize">/{key}</p>
                      <Field
                        label="Meta title"
                        value={routeSeo.metaTitle ?? ''}
                        onChange={(v) =>
                          patch({
                            routeSeo: {
                              ...config.routeSeo,
                              [key]: { ...routeSeo, metaTitle: v },
                            },
                          })
                        }
                      />
                      <TextArea
                        label="Meta description"
                        value={routeSeo.metaDescription ?? ''}
                        onChange={(v) =>
                          patch({
                            routeSeo: {
                              ...config.routeSeo,
                              [key]: { ...routeSeo, metaDescription: v },
                            },
                          })
                        }
                        rows={2}
                      />
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(routeSeo.noIndex)}
                          onChange={(e) =>
                            patch({
                              routeSeo: {
                                ...config.routeSeo,
                                [key]: { ...routeSeo, noIndex: e.target.checked },
                              },
                            })
                          }
                        />
                        Hide from search engines
                      </label>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save site settings
        </Button>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
