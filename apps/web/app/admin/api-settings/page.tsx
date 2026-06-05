'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Save, Zap } from 'lucide-react';
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
  BASIC_PLAN_MODEL_LABELS,
  BASIC_PLAN_MODELS,
  OPENAI_MODELS,
  OPENAI_PURPOSES,
  PRO_PLAN_MODEL_LABELS,
  PRO_PLAN_MODELS,
  type AiApiSettingsPublic,
  type BasicPlanModel,
  type OpenAiModel,
  type ProPlanModel,
} from '@hellodownloader/shared-types';

type ApiSettingsResponse = {
  settings: AiApiSettingsPublic;
  mapping: {
    basicPlan: { label: string; model: BasicPlanModel };
    proPlan: { label: string; model: ProPlanModel };
    openai: { label: string; model: OpenAiModel };
  };
  envVars: Record<string, string>;
};

function modelLabel(model: string, map: Record<string, string>) {
  return map[model] ?? model;
}

export default function AdminApiSettingsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiSettingsResponse | null>(null);

  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState<OpenAiModel>('gpt-5-mini');
  const [openaiToken, setOpenaiToken] = useState<string | null>(null);
  const [openaiTesting, setOpenaiTesting] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);

  const [freepikKey, setFreepikKey] = useState('');
  const [freepikToken, setFreepikToken] = useState<string | null>(null);
  const [freepikTesting, setFreepikTesting] = useState(false);
  const [freepikSaving, setFreepikSaving] = useState(false);

  const [basicPlanModel, setBasicPlanModel] = useState<BasicPlanModel>('flux-dev');
  const [proPlanModel, setProPlanModel] = useState<ProPlanModel>('seedream-v4');
  const [planSaving, setPlanSaving] = useState(false);

  const [features, setFeatures] = useState<AiApiSettingsPublic['features']>({
    enableAiAnalysis: true,
    enableAiThumbnailGeneration: true,
    enableAiImproveThumbnail: true,
    enableAutoCategoryDetection: true,
    enableThumbnailScoring: true,
    enableAutoLayoutDetection: true,
  });
  const [featuresSaving, setFeaturesSaving] = useState(false);

  const applyResponse = useCallback((res: ApiSettingsResponse) => {
    setData(res);
    setOpenaiModel(res.settings.openaiModel);
    setBasicPlanModel(res.settings.basicPlanModel);
    setProPlanModel(res.settings.proPlanModel);
    setFeatures(res.settings.features);
    setOpenaiKey(res.settings.hasOpenaiApiKey ? res.settings.openaiApiKeyMasked : '');
    setFreepikKey(res.settings.hasFreepikApiKey ? res.settings.freepikApiKeyMasked : '');
    setOpenaiToken(null);
    setFreepikToken(null);
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

  const openaiKeyChanged = Boolean(
    openaiKey.trim() && !openaiKey.includes('•') && openaiKey !== data?.settings.openaiApiKeyMasked,
  );
  const freepikKeyChanged = Boolean(
    freepikKey.trim() && !freepikKey.includes('•') && freepikKey !== data?.settings.freepikApiKeyMasked,
  );

  const testOpenAi = async () => {
    if (!openaiKey.trim()) {
      toast.error('OpenAI API key is required');
      return;
    }
    setOpenaiTesting(true);
    try {
      const res = (await apiClient.admin.testOpenAiApi({
        apiKey: openaiKey.trim(),
        openaiModel,
      })) as { verificationToken: string; message: string };
      setOpenaiToken(res.verificationToken);
      toast.success(res.message || 'OpenAI connection successful');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OpenAI test failed');
      await load();
    } finally {
      setOpenaiTesting(false);
    }
  };

  const saveOpenAi = async () => {
    if (!openaiModel) {
      toast.error('OpenAI model is required');
      return;
    }
    if (!openaiKey.trim() && !data?.settings.hasOpenaiApiKey) {
      toast.error('OpenAI API key is required');
      return;
    }
    if (openaiKeyChanged && !openaiToken) {
      toast.error('Test OpenAI connection before saving a new API key');
      return;
    }
    setOpenaiSaving(true);
    try {
      const res = (await apiClient.admin.saveOpenAiApi({
        apiKey: openaiKeyChanged ? openaiKey.trim() : undefined,
        openaiModel,
        verificationToken: openaiToken ?? undefined,
      })) as ApiSettingsResponse;
      applyResponse(res);
      toast.success('OpenAI settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save OpenAI settings');
    } finally {
      setOpenaiSaving(false);
    }
  };

  const testFreepik = async () => {
    if (!freepikKey.trim()) {
      toast.error('Freepik API key is required');
      return;
    }
    setFreepikTesting(true);
    try {
      const res = (await apiClient.admin.testFreepikApi({ apiKey: freepikKey.trim() })) as {
        verificationToken: string;
        message: string;
      };
      setFreepikToken(res.verificationToken);
      toast.success(res.message || 'Freepik connection successful');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Freepik test failed');
      await load();
    } finally {
      setFreepikTesting(false);
    }
  };

  const saveFreepik = async () => {
    if (!freepikKey.trim() && !data?.settings.hasFreepikApiKey) {
      toast.error('Freepik API key is required');
      return;
    }
    if (freepikKeyChanged && !freepikToken) {
      toast.error('Test Freepik connection before saving a new API key');
      return;
    }
    setFreepikSaving(true);
    try {
      const res = (await apiClient.admin.saveFreepikApi({
        apiKey: freepikKeyChanged ? freepikKey.trim() : undefined,
        verificationToken: freepikToken ?? undefined,
      })) as ApiSettingsResponse;
      applyResponse(res);
      toast.success('Freepik settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save Freepik settings');
    } finally {
      setFreepikSaving(false);
    }
  };

  const savePlanModels = async () => {
    setPlanSaving(true);
    try {
      const res = (await apiClient.admin.savePlanModels({ basicPlanModel, proPlanModel })) as ApiSettingsResponse;
      applyResponse(res);
      toast.success('Plan models saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save plan models');
    } finally {
      setPlanSaving(false);
    }
  };

  const saveFeatures = async () => {
    setFeaturesSaving(true);
    try {
      const res = (await apiClient.admin.saveAiFeatures(features)) as ApiSettingsResponse;
      applyResponse(res);
      toast.success('Feature toggles saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save features');
    } finally {
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
        description="Manage AI providers, models, API keys, and plan-to-model mapping."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* OpenAI */}
        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">OpenAI Settings</CardTitle>
            <CardDescription>
              Used for analysis features — category detection, headlines, CTR optimization, scoring, and layout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              {OPENAI_PURPOSES.map((p) => (
                <li key={p} className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary shrink-0" />
                  {p}
                </li>
              ))}
            </ul>

            <SecretKeyInput
              label="OpenAI API Key"
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder="sk-…"
              hint="Required. Test connection before saving a new key."
            />

            <div className="space-y-2">
              <Label>OpenAI Model</Label>
              <Select value={openaiModel} onValueChange={(v) => setOpenaiModel(v as OpenAiModel)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ConnectionStatusBadge
              status={settings?.openaiConnectionStatus ?? 'unknown'}
              loading={openaiTesting}
              lastTestedAt={settings?.openaiLastTestedAt}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => void testOpenAi()} disabled={openaiTesting || openaiSaving}>
                {openaiTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Connection
              </Button>
              <Button onClick={() => void saveOpenAi()} disabled={openaiSaving || openaiTesting}>
                {openaiSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save API Key
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Freepik */}
        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Freepik Settings</CardTitle>
            <CardDescription>Image assets and stock resources for thumbnail generation workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SecretKeyInput
              label="Freepik API Key"
              value={freepikKey}
              onChange={setFreepikKey}
              placeholder="fpk_…"
              hint="Required. Test connection before saving a new key."
            />

            <ConnectionStatusBadge
              status={settings?.freepikConnectionStatus ?? 'unknown'}
              loading={freepikTesting}
              lastTestedAt={settings?.freepikLastTestedAt}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => void testFreepik()} disabled={freepikTesting || freepikSaving}>
                {freepikTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Test Connection
              </Button>
              <Button onClick={() => void saveFreepik()} disabled={freepikSaving || freepikTesting}>
                {freepikSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save API Key
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Basic Plan */}
        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Basic Plan AI Model</CardTitle>
            <CardDescription>Used for Free / Basic plan thumbnail generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={basicPlanModel} onValueChange={(v) => setBasicPlanModel(v as BasicPlanModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASIC_PLAN_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {BASIC_PLAN_MODEL_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Pro Plan AI Model</CardTitle>
            <CardDescription>Premium models for Pro plan thumbnail generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={proPlanModel} onValueChange={(v) => setProPlanModel(v as ProPlanModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRO_PLAN_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PRO_PLAN_MODEL_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-[17px] mb-6">
        <Button onClick={() => void savePlanModels()} disabled={planSaving}>
          {planSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Plan Models
        </Button>
        <p className="text-xs text-muted-foreground">
          Saves both Basic and Pro plan models together.
        </p>
      </div>

      {/* Provider Mapping */}
      <Card className="border-white/10 bg-card/50 mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Provider Mapping</CardTitle>
          <CardDescription>Current plan and provider assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {data && (
              <>
                <MappingRow
                  label={data.mapping.basicPlan.label}
                  value={modelLabel(data.mapping.basicPlan.model, BASIC_PLAN_MODEL_LABELS)}
                />
                <MappingRow
                  label={data.mapping.proPlan.label}
                  value={modelLabel(data.mapping.proPlan.model, PRO_PLAN_MODEL_LABELS)}
                />
                <MappingRow label="OpenAI" value={data.mapping.openai.model} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card className="border-white/10 bg-card/50 mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Feature Toggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ['enableAiAnalysis', 'Enable AI Analysis'],
              ['enableAiThumbnailGeneration', 'Enable AI Thumbnail Generation'],
              ['enableAiImproveThumbnail', 'Enable AI Improve Thumbnail'],
              ['enableAutoCategoryDetection', 'Enable Auto Category Detection'],
              ['enableThumbnailScoring', 'Enable Thumbnail Scoring'],
              ['enableAutoLayoutDetection', 'Enable Auto Layout Detection'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-lg border border-white/5 px-4 py-3">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={features[key]}
                onCheckedChange={(checked) => setFeatures((f) => ({ ...f, [key]: checked }))}
              />
            </div>
          ))}
          <Button onClick={() => void saveFeatures()} disabled={featuresSaving}>
            {featuresSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Feature Toggles
          </Button>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="border-white/10 bg-card/50 mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Environment Variables</CardTitle>
          <CardDescription>
            Optional fallbacks for first-time import. Production values are stored in the database via this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_API_ENV_VARS.map((name) => (
            <div
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-4 py-3"
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
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1 flex items-center gap-2">
        <span className="text-muted-foreground">→</span> {value}
      </p>
    </div>
  );
}
