'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Save, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { SecretKeyInput } from '@/components/admin/api-settings/SecretKeyInput';
import { ConnectionStatusBadge } from '@/components/admin/api-settings/ConnectionStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToastStack, useToast } from '@/components/ui/toast';
import {
  AI_API_ENV_VARS,
  basicImageModelsForProvider,
  DEFAULT_AI_API_SETTINGS,
  IMAGE_MODEL_LABELS,
  IMAGE_PROVIDER_LABELS,
  IMAGE_PROVIDERS,
  isMaskedApiKey,
  OPENAI_TEXT_MODEL_LABELS,
  OPENAI_TEXT_MODELS,
  OPENAI_TEXT_PURPOSES,
  proImageModelsForProvider,
  TEXT_PROVIDER_LABELS,
  type AiApiSettingsPublic,
  type BasicImageModel,
  type ConnectionStatus,
  type ImageProvider,
  type OpenAiTextModel,
  type ProImageModel,
} from '@hellodownloader/shared-types';

type FeatureKey = keyof AiApiSettingsPublic['features'];

const DEFAULT_FEATURES = DEFAULT_AI_API_SETTINGS.features;

const FEATURE_TOGGLE_LABELS: Record<FeatureKey, { label: string; hint: string }> = {
  enableAiAnalysis: {
    label: 'Enable AI Analysis (Text/Vision API)',
    hint: 'Required for CTR strategy, vision analysis, and AI Adjust.',
  },
  enableAiThumbnailGeneration: {
    label: 'Enable AI Thumbnail Generate',
    hint: 'Allows creating a brand-new thumbnail from CTR strategy (Pro users).',
  },
  enableAiImproveThumbnail: {
    label: 'Enable AI Thumbnail Adjust',
    hint: 'Allows AI Adjust — redesign existing thumbnail for a target ratio.',
  },
  enableAutoCategoryDetection: {
    label: 'Enable Auto Category Detection',
    hint: 'Uses AI to suggest video category during headline strategy.',
  },
  enableThumbnailScoring: {
    label: 'Enable Thumbnail Scoring',
    hint: 'Scores thumbnails for CTR potential in strategy output.',
  },
  enableAutoLayoutDetection: {
    label: 'Enable Auto Layout Detection',
    hint: 'Detects text layout zones during vision analysis.',
  },
};

type ApiSettingsResponse = {
  settings: AiApiSettingsPublic;
  mapping: {
    text: { provider: string; model: OpenAiTextModel };
    image: { provider: ImageProvider; basicModel: BasicImageModel; proModel: ProImageModel };
  };
  envVars: Record<string, string>;
};

export default function AdminApiSettingsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiSettingsResponse | null>(null);

  const [textModel, setTextModel] = useState<OpenAiTextModel>('gpt-5-mini');
  const [imageProvider, setImageProvider] = useState<ImageProvider>('fal');
  const [basicImageModel, setBasicImageModel] = useState<BasicImageModel>('flux-dev');
  const [proImageModel, setProImageModel] = useState<ProImageModel>('flux-kontext-pro');

  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiToken, setOpenaiToken] = useState<string | null>(null);
  const [openaiTesting, setOpenaiTesting] = useState(false);

  const [falKey, setFalKey] = useState('');
  const [falToken, setFalToken] = useState<string | null>(null);
  const [falTesting, setFalTesting] = useState(false);

  const [saving, setSaving] = useState(false);

  const [features, setFeatures] = useState<AiApiSettingsPublic['features']>(DEFAULT_FEATURES);
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [savingFeatureKey, setSavingFeatureKey] = useState<FeatureKey | null>(null);

  const basicOptions = basicImageModelsForProvider(imageProvider);
  const proOptions = proImageModelsForProvider(imageProvider);

  const applyResponse = useCallback((res: ApiSettingsResponse) => {
    setData(res);
    setTextModel(res.settings.textModel);
    setImageProvider(res.settings.imageProvider);
    setBasicImageModel(res.settings.basicImageModel);
    setProImageModel(res.settings.proImageModel);
    setFeatures({ ...DEFAULT_FEATURES, ...res.settings.features });
    setOpenaiKey(res.settings.hasOpenaiApiKey ? res.settings.openaiApiKeyMasked : '');
    setFalKey(res.settings.hasFalApiKey ? res.settings.falApiKeyMasked : '');
    setOpenaiToken(null);
    setFalToken(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await apiClient.admin.getApiSettings()) as ApiSettingsResponse;
      applyResponse(res);
    } catch (e) {
      toastRef.current.error(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!basicOptions.includes(basicImageModel)) {
      setBasicImageModel(basicOptions[0] ?? 'flux-dev');
    }
    if (!proOptions.includes(proImageModel)) {
      setProImageModel(proOptions[0] ?? 'flux-kontext-pro');
    }
  }, [imageProvider, basicOptions, proOptions, basicImageModel, proImageModel]);

  const openaiKeyChanged = Boolean(
    openaiKey.trim() &&
      !isMaskedApiKey(openaiKey) &&
      openaiKey !== data?.settings.openaiApiKeyMasked,
  );
  const falKeyChanged = Boolean(
    falKey.trim() && !isMaskedApiKey(falKey) && falKey !== data?.settings.falApiKeyMasked,
  );

  const patchOpenAiConnection = (status: ConnectionStatus, lastTestedAt: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...prev.settings,
              openaiConnectionStatus: status,
              openaiLastTestedAt: lastTestedAt,
            },
          }
        : prev,
    );
  };

  const patchFalConnection = (status: ConnectionStatus, lastTestedAt: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...prev.settings,
              falConnectionStatus: status,
              falLastTestedAt: lastTestedAt,
            },
          }
        : prev,
    );
  };

  const testOpenAi = async () => {
    const hasDraftKey = Boolean(openaiKey.trim() && !isMaskedApiKey(openaiKey));
    const hasStoredKey = Boolean(data?.settings.hasOpenaiApiKey);
    if (!hasDraftKey && !hasStoredKey) {
      toast.error('OpenAI API key is required');
      return;
    }

    setOpenaiTesting(true);
    const testedAt = new Date().toISOString();
    try {
      const res = (await apiClient.admin.testOpenAiApi({
        apiKey: hasDraftKey ? openaiKey.trim() : undefined,
        textModel,
      })) as { verificationToken: string; message: string };
      setOpenaiToken(res.verificationToken);
      patchOpenAiConnection('connected', testedAt);
      toast.success(res.message || 'OpenAI connection successful');
    } catch (e) {
      patchOpenAiConnection('failed', testedAt);
      toast.error(e instanceof Error ? e.message : 'OpenAI test failed');
    } finally {
      setOpenaiTesting(false);
    }
  };

  const testFal = async () => {
    const hasDraftKey = Boolean(falKey.trim() && !isMaskedApiKey(falKey));
    const hasStoredKey = Boolean(data?.settings.hasFalApiKey);
    if (!hasDraftKey && !hasStoredKey) {
      toast.error('fal.ai API key is required');
      return;
    }

    setFalTesting(true);
    const testedAt = new Date().toISOString();
    try {
      const res = (await apiClient.admin.testFalApi({
        apiKey: hasDraftKey ? falKey.trim() : undefined,
      })) as { verificationToken: string; message: string };
      setFalToken(res.verificationToken);
      patchFalConnection('connected', testedAt);
      toast.success(res.message || 'fal.ai connection successful');
    } catch (e) {
      patchFalConnection('failed', testedAt);
      toast.error(e instanceof Error ? e.message : 'fal.ai test failed');
    } finally {
      setFalTesting(false);
    }
  };

  const saveProviders = async () => {
    if (openaiKeyChanged && !openaiToken) {
      toast.error('Test OpenAI connection before saving a new API key');
      return;
    }
    if (imageProvider === 'fal' && falKeyChanged && !falToken) {
      toast.error('Test fal.ai connection before saving a new API key');
      return;
    }
    if (imageProvider === 'openai' && !settings?.hasOpenaiApiKey && !openaiKeyChanged) {
      toast.error('Configure and test your OpenAI API key before saving with OpenAI as image provider');
      return;
    }
    if (imageProvider === 'fal' && !settings?.hasFalApiKey && !falKeyChanged) {
      toast.error('Configure and test your fal.ai API key before saving');
      return;
    }

    setSaving(true);
    try {
      const res = (await apiClient.admin.saveAiProviders({
        textModel,
        imageProvider,
        basicImageModel,
        proImageModel,
        openaiApiKey: openaiKeyChanged ? openaiKey.trim() : undefined,
        openaiVerificationToken: openaiToken ?? undefined,
        falApiKey: falKeyChanged ? falKey.trim() : undefined,
        falVerificationToken: falToken ?? undefined,
      })) as ApiSettingsResponse;
      applyResponse(res);
      toast.success('AI provider settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = async (key: FeatureKey, checked: boolean) => {
    const previous = features;
    const next = { ...features, [key]: checked };
    setFeatures(next);
    setSavingFeatureKey(key);
    setFeaturesSaving(true);
    try {
      const res = (await apiClient.admin.saveAiFeatures(next)) as ApiSettingsResponse;
      applyResponse(res);
      toast.success(`${checked ? 'Enabled' : 'Disabled'}: ${FEATURE_TOGGLE_LABELS[key].label}`);
    } catch (e) {
      setFeatures(previous);
      toast.error(e instanceof Error ? e.message : 'Failed to save feature toggle');
    } finally {
      setSavingFeatureKey(null);
      setFeaturesSaving(false);
    }
  };

  const copyEnv = async (name: string) => {
    await navigator.clipboard.writeText(name);
    toast.success(`Copied ${name}`);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading API settings…
      </div>
    );
  }

  const settings = data?.settings;

  return (
    <>
      <AdminPageHeader
        title="API Settings"
        description="Enable or disable AI features, then configure providers and API keys."
      />

      {/* Feature Toggles — first so enable/disable is easy to find */}
      <Card className="border-primary/30 bg-card/50 mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Enable / Disable AI Features</CardTitle>
          <CardDescription>
            Toggle each feature on or off. Changes save automatically and apply site-wide immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">AI API &amp; Thumbnail Tools</h3>
            {(['enableAiAnalysis', 'enableAiImproveThumbnail', 'enableAiThumbnailGeneration'] as const).map(
              (key) => (
                <FeatureToggleRow
                  key={key}
                  id={key}
                  label={FEATURE_TOGGLE_LABELS[key].label}
                  hint={FEATURE_TOGGLE_LABELS[key].hint}
                  checked={Boolean(features[key])}
                  saving={savingFeatureKey === key}
                  disabled={featuresSaving && savingFeatureKey !== key}
                  onCheckedChange={(checked) => void updateFeature(key, checked)}
                />
              ),
            )}
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">Advanced Analysis (optional)</h3>
            {(['enableAutoCategoryDetection', 'enableThumbnailScoring', 'enableAutoLayoutDetection'] as const).map(
              (key) => (
                <FeatureToggleRow
                  key={key}
                  id={key}
                  label={FEATURE_TOGGLE_LABELS[key].label}
                  hint={FEATURE_TOGGLE_LABELS[key].hint}
                  checked={Boolean(features[key])}
                  saving={savingFeatureKey === key}
                  disabled={featuresSaving && savingFeatureKey !== key}
                  onCheckedChange={(checked) => void updateFeature(key, checked)}
                />
              ),
            )}
          </section>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50 mb-6">
        <CardHeader>
          <CardTitle className="text-lg">AI Providers</CardTitle>
          <CardDescription>
            Text AI uses OpenAI. Image AI can use fal.ai or OpenAI for thumbnail generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Text AI */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Text AI Provider</h3>
              <p className="text-xs text-muted-foreground">
                {TEXT_PROVIDER_LABELS.openai} — analysis, headlines, CTR, and scoring.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              {OPENAI_TEXT_PURPOSES.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Text Model</Label>
                <Select value={textModel} onValueChange={(v) => setTextModel(v as OpenAiTextModel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENAI_TEXT_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {OPENAI_TEXT_MODEL_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SecretKeyInput
              label="OpenAI API Key"
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder="sk-…"
              hint={
                imageProvider === 'openai'
                  ? 'Required for text and image AI. Test before saving a new key.'
                  : 'Required for text AI. Test before saving a new key.'
              }
              configured={settings?.hasOpenaiApiKey}
            />
            <ConnectionStatusBadge
              status={settings?.openaiConnectionStatus ?? 'unknown'}
              loading={openaiTesting}
              lastTestedAt={settings?.openaiLastTestedAt}
            />
            <Button
              variant="outline"
              onClick={() => void testOpenAi()}
              disabled={openaiTesting || saving}
            >
              {openaiTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Test OpenAI Connection
            </Button>
          </section>

          <div className="border-t border-border" />

          {/* Image AI */}
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Image AI Provider</h3>
              <p className="text-xs text-muted-foreground">
                Used for thumbnail image generation.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Image Provider</Label>
                <Select
                  value={imageProvider}
                  onValueChange={(v) => setImageProvider(v as ImageProvider)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {IMAGE_PROVIDER_LABELS[p]}
                        {p === 'fal' ? ' (default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Basic Plan Model</Label>
                <Select
                  value={basicImageModel}
                  onValueChange={(v) => setBasicImageModel(v as BasicImageModel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {basicOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {IMAGE_MODEL_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pro Plan Model</Label>
                <Select
                  value={proImageModel}
                  onValueChange={(v) => setProImageModel(v as ProImageModel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {proOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {IMAGE_MODEL_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {imageProvider === 'openai' ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 space-y-3">
                <p className="text-sm font-medium">OpenAI powers image generation</p>
                <p className="text-xs text-muted-foreground">
                  Image generation uses the same OpenAI API key configured in the Text AI section above.
                  Test and save your OpenAI key there, then click Save Settings below.
                </p>
                <ConnectionStatusBadge
                  status={settings?.openaiConnectionStatus ?? 'unknown'}
                  loading={openaiTesting}
                  lastTestedAt={settings?.openaiLastTestedAt}
                />
                <Button
                  variant="outline"
                  onClick={() => void testOpenAi()}
                  disabled={openaiTesting || saving}
                >
                  {openaiTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test OpenAI Connection
                </Button>
              </div>
            ) : (
              <>
                <SecretKeyInput
                  label="fal.ai API Key"
                  value={falKey}
                  onChange={setFalKey}
                  placeholder="fal_…"
                  hint="Required for fal.ai image generation. Test before saving a new key."
                  configured={settings?.hasFalApiKey}
                />
                <ConnectionStatusBadge
                  status={settings?.falConnectionStatus ?? 'unknown'}
                  loading={falTesting}
                  lastTestedAt={settings?.falLastTestedAt}
                />
                <Button
                  variant="outline"
                  onClick={() => void testFal()}
                  disabled={falTesting || saving}
                >
                  {falTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test fal.ai Connection
                </Button>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void saveProviders()} disabled={saving || openaiTesting || falTesting}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Provider Mapping */}
      <Card className="border-border bg-card/50 mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Provider Mapping</CardTitle>
          <CardDescription>Current text and image provider assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data && (
              <>
                <MappingRow
                  label="Text AI"
                  value={`${TEXT_PROVIDER_LABELS[data.mapping.text.provider as keyof typeof TEXT_PROVIDER_LABELS]} → ${data.mapping.text.model}`}
                />
                <MappingRow
                  label="Image AI"
                  value={`${IMAGE_PROVIDER_LABELS[data.mapping.image.provider]} → Basic: ${IMAGE_MODEL_LABELS[data.mapping.image.basicModel]}`}
                />
                <MappingRow
                  label="Pro Image Model"
                  value={IMAGE_MODEL_LABELS[data.mapping.image.proModel]}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Environment Variables</CardTitle>
          <CardDescription>
            Optional fallbacks for first-time import. Production values are stored in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_API_ENV_VARS.map((name) => (
            <div
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3"
            >
              <code className="text-sm font-mono text-primary">{name}</code>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{data?.envVars[name] ?? '—'}</span>
                <Button variant="outline" size="sm" onClick={() => void copyEnv(name)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ToastStack toasts={toast.toasts} onDismiss={toast.dismiss} />
    </>
  );
}

function MappingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-accent/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1 break-words">{value}</p>
    </div>
  );
}

function FeatureToggleRow({
  id,
  label,
  hint,
  checked,
  saving,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  saving?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={checked}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled && !saving) onCheckedChange(!checked);
      }}
      onKeyDown={(e) => {
        if (disabled || saving) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCheckedChange(!checked);
        }
      }}
      className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3 cursor-pointer hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded',
              checked ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-muted-foreground',
            )}
          >
            {checked ? 'On' : 'Off'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        <Switch
          id={id}
          checked={checked}
          disabled={disabled || saving}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </div>
  );
}
