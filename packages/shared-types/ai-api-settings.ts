export const OPENAI_MODELS = ['gpt-5-mini', 'gpt-5'] as const;
export type OpenAiModel = (typeof OPENAI_MODELS)[number];

/** Free / Basic plan thumbnail generation models. */
export const BASIC_PLAN_MODELS = [
  'flux-dev',
  'flux-2-turbo',
  'flux-2-klein-1k',
  'classic-fast',
] as const;
export type BasicPlanModel = (typeof BASIC_PLAN_MODELS)[number];

/** Pro plan thumbnail generation models. */
export const PRO_PLAN_MODELS = [
  'seedream-v4',
  'seedream-v4-5',
  'seedream-v5-lite',
  'flux-kontext-pro',
  'flux-pro-1-1',
  'flux-2-pro',
] as const;
export type ProPlanModel = (typeof PRO_PLAN_MODELS)[number];

export type ConnectionStatus = 'unknown' | 'connected' | 'failed';

export type AiApiFeatureToggles = {
  enableAiAnalysis: boolean;
  enableAiThumbnailGeneration: boolean;
  enableAiImproveThumbnail: boolean;
  enableAutoCategoryDetection: boolean;
  enableThumbnailScoring: boolean;
  enableAutoLayoutDetection: boolean;
};

export type AiApiSettingsPublic = {
  openaiModel: OpenAiModel;
  basicPlanModel: BasicPlanModel;
  proPlanModel: ProPlanModel;
  openaiConnectionStatus: ConnectionStatus;
  freepikConnectionStatus: ConnectionStatus;
  openaiLastTestedAt: string | null;
  freepikLastTestedAt: string | null;
  hasOpenaiApiKey: boolean;
  hasFreepikApiKey: boolean;
  openaiApiKeyMasked: string;
  freepikApiKeyMasked: string;
  features: AiApiFeatureToggles;
  updatedAt: string;
};

export type AiApiProviderMapping = {
  basicPlan: { label: string; model: BasicPlanModel };
  proPlan: { label: string; model: ProPlanModel };
  openai: { label: string; model: OpenAiModel };
};

export const BASIC_PLAN_MODEL_LABELS: Record<BasicPlanModel, string> = {
  'flux-dev': 'Flux Dev (Default)',
  'flux-2-turbo': 'Flux 2 Turbo',
  'flux-2-klein-1k': 'Flux 2 Klein 1K',
  'classic-fast': 'Classic Fast',
};

export const PRO_PLAN_MODEL_LABELS: Record<ProPlanModel, string> = {
  'seedream-v4': 'Seedream V4 (Default)',
  'seedream-v4-5': 'Seedream V4.5',
  'seedream-v5-lite': 'Seedream V5 Lite',
  'flux-kontext-pro': 'Flux Kontext Pro',
  'flux-pro-1-1': 'Flux Pro 1.1',
  'flux-2-pro': 'Flux 2 Pro',
};

export const OPENAI_MODEL_LABELS: Record<OpenAiModel, string> = {
  'gpt-5-mini': 'gpt-5-mini',
  'gpt-5': 'gpt-5',
};

export const OPENAI_PURPOSES = [
  'Category Detection',
  'Thumbnail Analysis',
  'Headline Generation',
  'CTR Optimization',
  'Layout Recommendations',
  'Thumbnail Scoring',
] as const;

export const AI_API_ENV_VARS = [
  'OPENAI_API_KEY',
  'FREEPIK_API_KEY',
  'OPENAI_MODEL',
  'BASIC_PLAN_MODEL',
  'PRO_PLAN_MODEL',
] as const;

export const DEFAULT_AI_API_SETTINGS = {
  openaiModel: 'gpt-5-mini' as OpenAiModel,
  basicPlanModel: 'flux-dev' as BasicPlanModel,
  proPlanModel: 'seedream-v4' as ProPlanModel,
  features: {
    enableAiAnalysis: true,
    enableAiThumbnailGeneration: true,
    enableAiImproveThumbnail: true,
    enableAutoCategoryDetection: true,
    enableThumbnailScoring: true,
    enableAutoLayoutDetection: true,
  } satisfies AiApiFeatureToggles,
};

export function normalizeBasicPlanModel(value: string): BasicPlanModel {
  if (BASIC_PLAN_MODELS.includes(value as BasicPlanModel)) {
    return value as BasicPlanModel;
  }
  return DEFAULT_AI_API_SETTINGS.basicPlanModel;
}

export function normalizeProPlanModel(value: string): ProPlanModel {
  if (PRO_PLAN_MODELS.includes(value as ProPlanModel)) {
    return value as ProPlanModel;
  }
  return DEFAULT_AI_API_SETTINGS.proPlanModel;
}
