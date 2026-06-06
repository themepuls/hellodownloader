export const TEXT_PROVIDERS = ['openai'] as const;
export type TextProvider = (typeof TEXT_PROVIDERS)[number];

export const IMAGE_PROVIDERS = ['fal', 'openai'] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export const OPENAI_TEXT_MODELS = ['gpt-5-mini', 'gpt-5'] as const;
export type OpenAiTextModel = (typeof OPENAI_TEXT_MODELS)[number];

/** @deprecated use OpenAiTextModel */
export type OpenAiModel = OpenAiTextModel;

export const OPENAI_IMAGE_MODELS = ['gpt-image-1'] as const;
export type OpenAiImageModel = (typeof OPENAI_IMAGE_MODELS)[number];

export const FAL_IMAGE_MODELS = [
  'flux-schnell',
  'flux-dev',
  'flux-pro',
  'flux-kontext-pro',
] as const;
export type FalImageModel = (typeof FAL_IMAGE_MODELS)[number];

export const BASIC_IMAGE_MODELS = ['flux-schnell', 'flux-dev', 'gpt-image-1'] as const;
export type BasicImageModel = (typeof BASIC_IMAGE_MODELS)[number];

export const PRO_IMAGE_MODELS = ['flux-pro', 'flux-kontext-pro', 'gpt-image-1'] as const;
export type ProImageModel = (typeof PRO_IMAGE_MODELS)[number];

export type ImageModel = BasicImageModel | ProImageModel;

/** @deprecated use BasicImageModel */
export type BasicPlanModel = BasicImageModel;

/** @deprecated use ProImageModel */
export type ProPlanModel = ProImageModel;

/** @deprecated use BASIC_IMAGE_MODELS */
export const BASIC_PLAN_MODELS = BASIC_IMAGE_MODELS;

/** @deprecated use PRO_IMAGE_MODELS */
export const PRO_PLAN_MODELS = PRO_IMAGE_MODELS;

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
  textProvider: TextProvider;
  textModel: OpenAiTextModel;
  imageProvider: ImageProvider;
  basicImageModel: BasicImageModel;
  proImageModel: ProImageModel;
  openaiConnectionStatus: ConnectionStatus;
  falConnectionStatus: ConnectionStatus;
  openaiLastTestedAt: string | null;
  falLastTestedAt: string | null;
  hasOpenaiApiKey: boolean;
  hasFalApiKey: boolean;
  openaiApiKeyMasked: string;
  falApiKeyMasked: string;
  features: AiApiFeatureToggles;
  updatedAt: string;
};

export type AiApiProviderMapping = {
  text: { provider: TextProvider; model: OpenAiTextModel };
  image: { provider: ImageProvider; basicModel: BasicImageModel; proModel: ProImageModel };
};

export const TEXT_PROVIDER_LABELS: Record<TextProvider, string> = {
  openai: 'OpenAI',
};

export const IMAGE_PROVIDER_LABELS: Record<ImageProvider, string> = {
  fal: 'fal.ai',
  openai: 'OpenAI',
};

export const OPENAI_TEXT_MODEL_LABELS: Record<OpenAiTextModel, string> = {
  'gpt-5-mini': 'gpt-5-mini (default)',
  'gpt-5': 'gpt-5',
};

/** @deprecated use OPENAI_TEXT_MODEL_LABELS */
export const OPENAI_MODEL_LABELS = OPENAI_TEXT_MODEL_LABELS;

/** @deprecated use OPENAI_TEXT_MODELS */
export const OPENAI_MODELS = OPENAI_TEXT_MODELS;

export const OPENAI_IMAGE_MODEL_LABELS: Record<OpenAiImageModel, string> = {
  'gpt-image-1': 'gpt-image-1',
};

export const FAL_IMAGE_MODEL_LABELS: Record<FalImageModel, string> = {
  'flux-schnell': 'flux-schnell',
  'flux-dev': 'flux-dev (default basic)',
  'flux-pro': 'flux-pro',
  'flux-kontext-pro': 'flux-kontext-pro (default pro)',
};

export const IMAGE_MODEL_LABELS: Record<ImageModel, string> = {
  ...FAL_IMAGE_MODEL_LABELS,
  ...OPENAI_IMAGE_MODEL_LABELS,
};

/** @deprecated use IMAGE_MODEL_LABELS */
export const BASIC_PLAN_MODEL_LABELS: Record<BasicImageModel, string> = {
  'flux-schnell': 'flux-schnell',
  'flux-dev': 'flux-dev (default)',
  'gpt-image-1': 'gpt-image-1',
};

/** @deprecated use IMAGE_MODEL_LABELS */
export const PRO_PLAN_MODEL_LABELS: Record<ProImageModel, string> = {
  'flux-pro': 'flux-pro',
  'flux-kontext-pro': 'flux-kontext-pro (default)',
  'gpt-image-1': 'gpt-image-1',
};

export const OPENAI_TEXT_PURPOSES = [
  'Category Detection',
  'Thumbnail Analysis',
  'Headline Generation',
  'CTR Optimization',
  'Layout Recommendations',
  'Thumbnail Scoring',
  'Hidden Prompt Processing',
] as const;

/** @deprecated use OPENAI_TEXT_PURPOSES */
export const OPENAI_PURPOSES = OPENAI_TEXT_PURPOSES;

export const AI_API_ENV_VARS = [
  'OPENAI_API_KEY',
  'FAL_API_KEY',
  'TEXT_PROVIDER',
  'TEXT_MODEL',
  'IMAGE_PROVIDER',
  'BASIC_IMAGE_MODEL',
  'PRO_IMAGE_MODEL',
] as const;

export const DEFAULT_AI_API_SETTINGS = {
  textProvider: 'openai' as TextProvider,
  textModel: 'gpt-5-mini' as OpenAiTextModel,
  imageProvider: 'fal' as ImageProvider,
  basicImageModel: 'flux-dev' as BasicImageModel,
  proImageModel: 'flux-kontext-pro' as ProImageModel,
  features: {
    enableAiAnalysis: true,
    enableAiThumbnailGeneration: false,
    enableAiImproveThumbnail: true,
    enableAutoCategoryDetection: true,
    enableThumbnailScoring: true,
    enableAutoLayoutDetection: true,
  } satisfies AiApiFeatureToggles,
};

/** User-facing flags derived from admin AI feature toggles. */
export function resolveThumbnailUiFeatures(features: AiApiFeatureToggles) {
  return {
    showHeadlineStrategy: features.enableAiAnalysis,
    showAdjust: features.enableAiImproveThumbnail,
    showGenerate: features.enableAiThumbnailGeneration,
    adjustReady: features.enableAiImproveThumbnail && features.enableAiAnalysis,
    generateReady: features.enableAiThumbnailGeneration && features.enableAiAnalysis,
  };
}

export const AI_FEATURE_ADMIN_LABELS: Record<keyof AiApiFeatureToggles, { label: string; hint: string }> = {
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

export function modelBelongsToImageProvider(model: string, provider: ImageProvider): boolean {
  if (provider === 'fal') {
    return (FAL_IMAGE_MODELS as readonly string[]).includes(model);
  }
  return (OPENAI_IMAGE_MODELS as readonly string[]).includes(model);
}

export function basicImageModelsForProvider(provider: ImageProvider): BasicImageModel[] {
  return BASIC_IMAGE_MODELS.filter((m) => modelBelongsToImageProvider(m, provider));
}

export function proImageModelsForProvider(provider: ImageProvider): ProImageModel[] {
  return PRO_IMAGE_MODELS.filter((m) => modelBelongsToImageProvider(m, provider));
}

export function normalizeTextProvider(value: string): TextProvider {
  if (TEXT_PROVIDERS.includes(value as TextProvider)) {
    return value as TextProvider;
  }
  return DEFAULT_AI_API_SETTINGS.textProvider;
}

export function normalizeImageProvider(value: string): ImageProvider {
  if (IMAGE_PROVIDERS.includes(value as ImageProvider)) {
    return value as ImageProvider;
  }
  return DEFAULT_AI_API_SETTINGS.imageProvider;
}

export function normalizeTextModel(value: string): OpenAiTextModel {
  if (OPENAI_TEXT_MODELS.includes(value as OpenAiTextModel)) {
    return value as OpenAiTextModel;
  }
  return DEFAULT_AI_API_SETTINGS.textModel;
}

/** @deprecated use normalizeTextModel */
export function normalizeOpenAiModel(value: string): OpenAiTextModel {
  return normalizeTextModel(value);
}

const LEGACY_MODEL_MAP: Record<string, string> = {
  'flux-2-turbo': 'flux-dev',
  'flux-2-klein-1k': 'flux-dev',
  'classic-fast': 'flux-schnell',
  'seedream-v4': 'flux-kontext-pro',
  'seedream-v4-5': 'flux-kontext-pro',
  'seedream-v5-lite': 'flux-kontext-pro',
  'flux-pro-1-1': 'flux-pro',
  'flux-2-pro': 'flux-pro',
};

export function normalizeBasicImageModel(
  value: string,
  provider: ImageProvider = DEFAULT_AI_API_SETTINGS.imageProvider,
): BasicImageModel {
  const mapped = LEGACY_MODEL_MAP[value] ?? value;
  const allowed = basicImageModelsForProvider(provider);
  if (allowed.includes(mapped as BasicImageModel)) {
    return mapped as BasicImageModel;
  }
  return allowed[0] ?? DEFAULT_AI_API_SETTINGS.basicImageModel;
}

export function normalizeProImageModel(
  value: string,
  provider: ImageProvider = DEFAULT_AI_API_SETTINGS.imageProvider,
): ProImageModel {
  const mapped = LEGACY_MODEL_MAP[value] ?? value;
  const allowed = proImageModelsForProvider(provider);
  if (allowed.includes(mapped as ProImageModel)) {
    return mapped as ProImageModel;
  }
  return allowed[0] ?? DEFAULT_AI_API_SETTINGS.proImageModel;
}

/** @deprecated use normalizeBasicImageModel */
export function normalizeBasicPlanModel(value: string): BasicImageModel {
  return normalizeBasicImageModel(value);
}

/** @deprecated use normalizeProImageModel */
export function normalizeProPlanModel(value: string): ProImageModel {
  return normalizeProImageModel(value);
}

export function isMaskedApiKey(value: string): boolean {
  return value.includes('•');
}

export function maskApiKey(value?: string): string {
  if (!value?.trim()) return '';
  const v = value.trim();
  if (v.length <= 8) return '••••••••';
  let prefix = v.slice(0, 3);
  if (v.startsWith('sk-')) prefix = 'sk-';
  else if (v.startsWith('fal_')) prefix = 'fal_';
  return `${prefix}${'•'.repeat(8)}${v.slice(-4)}`;
}

export function resolveImageModelForPlan(
  plan: 'FREE' | 'PRO' | 'BASIC',
  settings: Pick<AiApiSettingsPublic, 'basicImageModel' | 'proImageModel'>,
): ImageModel {
  return plan === 'PRO' ? settings.proImageModel : settings.basicImageModel;
}

export type ThumbnailAiMode = 'adjust' | 'generate';

/** Returns an error message when credentials are missing, or null when ready. */
export function validateThumbnailAiCredentials(input: {
  mode: ThumbnailAiMode;
  imageProvider: ImageProvider;
  openaiApiKey?: string | null;
  falApiKey?: string | null;
}): string | null {
  const hasOpenAi = Boolean(input.openaiApiKey?.trim());
  const hasFal = Boolean(input.falApiKey?.trim());

  if (input.mode === 'adjust' && !hasOpenAi) {
    return 'OpenAI API key is required for AI vision analysis (Admin → API Settings → Text AI).';
  }
  if (input.imageProvider === 'openai' && !hasOpenAi) {
    return 'Configure your OpenAI API key for image generation (Admin → API Settings).';
  }
  if (input.imageProvider === 'fal' && !hasFal) {
    return 'Configure your fal.ai API key for image generation (Admin → API Settings).';
  }
  return null;
}
