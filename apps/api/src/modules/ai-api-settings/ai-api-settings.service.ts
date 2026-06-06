import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  basicImageModelsForProvider,
  DEFAULT_AI_API_SETTINGS,
  isMaskedApiKey,
  maskApiKey,
  normalizeBasicImageModel,
  normalizeImageProvider,
  normalizeProImageModel,
  normalizeTextModel,
  normalizeTextProvider,
  OPENAI_TEXT_MODELS,
  proImageModelsForProvider,
  modelBelongsToImageProvider,
  type AiApiSettingsPublic,
  type BasicImageModel,
  type ConnectionStatus,
  type ImageProvider,
  type OpenAiTextModel,
  type ProImageModel,
  type TextProvider,
} from '@hellodownloader/shared-types';

type KeyProvider = 'openai' | 'fal';

type VerificationEntry = {
  provider: KeyProvider;
  apiKey: string;
  expiresAt: number;
};

function isMasked(value: string): boolean {
  return isMaskedApiKey(value);
}

@Injectable()
export class AiApiSettingsService implements OnModuleInit {
  private verificationTokens = new Map<string, VerificationEntry>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.importFromEnvIfEmpty();
  }

  private async ensureDefaults() {
    await this.prisma.aiApiSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        textProvider: DEFAULT_AI_API_SETTINGS.textProvider,
        textModel: DEFAULT_AI_API_SETTINGS.textModel,
        imageProvider: DEFAULT_AI_API_SETTINGS.imageProvider,
        basicImageModel: DEFAULT_AI_API_SETTINGS.basicImageModel,
        proImageModel: DEFAULT_AI_API_SETTINGS.proImageModel,
        enableAiAnalysis: DEFAULT_AI_API_SETTINGS.features.enableAiAnalysis,
        enableAiThumbnailGeneration:
          DEFAULT_AI_API_SETTINGS.features.enableAiThumbnailGeneration,
        enableAiImproveThumbnail: DEFAULT_AI_API_SETTINGS.features.enableAiImproveThumbnail,
        enableAutoCategoryDetection:
          DEFAULT_AI_API_SETTINGS.features.enableAutoCategoryDetection,
        enableThumbnailScoring: DEFAULT_AI_API_SETTINGS.features.enableThumbnailScoring,
        enableAutoLayoutDetection: DEFAULT_AI_API_SETTINGS.features.enableAutoLayoutDetection,
      },
      update: {},
    });
  }

  private async importFromEnvIfEmpty() {
    const row = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const patch: Record<string, string> = {};

    if (!row.openaiApiKey && process.env.OPENAI_API_KEY?.trim()) {
      patch.openaiApiKey = process.env.OPENAI_API_KEY.trim();
    }
    const falKey = process.env.FAL_API_KEY?.trim() || process.env.FAL_KEY?.trim();
    if (!row.falApiKey && falKey) {
      patch.falApiKey = falKey;
    }

    const textModel = process.env.TEXT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim();
    if (textModel && OPENAI_TEXT_MODELS.includes(textModel as OpenAiTextModel)) {
      patch.textModel = textModel;
    }

    const imageProvider = process.env.IMAGE_PROVIDER?.trim();
    if (imageProvider === 'fal' || imageProvider === 'openai') {
      patch.imageProvider = imageProvider;
    }

    const provider = normalizeImageProvider(patch.imageProvider ?? row.imageProvider);
    const basicModel = process.env.BASIC_IMAGE_MODEL?.trim() || process.env.BASIC_PLAN_MODEL?.trim();
    if (basicModel) {
      patch.basicImageModel = normalizeBasicImageModel(basicModel, provider);
    }

    const proModel = process.env.PRO_IMAGE_MODEL?.trim() || process.env.PRO_PLAN_MODEL?.trim();
    if (proModel) {
      patch.proImageModel = normalizeProImageModel(proModel, provider);
    }

    if (process.env.TEXT_PROVIDER?.trim() === 'openai') {
      patch.textProvider = 'openai';
    }

    if (Object.keys(patch).length > 0) {
      await this.prisma.aiApiSettings.update({ where: { id: 1 }, data: patch });
    }
  }

  private consumeVerificationToken(provider: KeyProvider, token: string, apiKey: string) {
    const entry = this.verificationTokens.get(token);
    this.verificationTokens.delete(token);
    if (!entry) return false;
    if (entry.provider !== provider) return false;
    if (entry.apiKey !== apiKey) return false;
    if (Date.now() > entry.expiresAt) return false;
    return true;
  }

  private issueVerificationToken(provider: KeyProvider, apiKey: string) {
    const token = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.verificationTokens.set(token, {
      provider,
      apiKey,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return token;
  }

  private toPublic(row: {
    textProvider: string;
    textModel: string;
    imageProvider: string;
    basicImageModel: string;
    proImageModel: string;
    openaiApiKey: string;
    openaiConnectionStatus: string;
    openaiLastTestedAt: Date | null;
    falApiKey: string;
    falConnectionStatus: string;
    falLastTestedAt: Date | null;
    enableAiAnalysis: boolean;
    enableAiThumbnailGeneration: boolean;
    enableAiImproveThumbnail: boolean;
    enableAutoCategoryDetection: boolean;
    enableThumbnailScoring: boolean;
    enableAutoLayoutDetection: boolean;
    updatedAt: Date;
  }): AiApiSettingsPublic {
    const imageProvider = normalizeImageProvider(row.imageProvider);
    return {
      textProvider: normalizeTextProvider(row.textProvider),
      textModel: normalizeTextModel(row.textModel),
      imageProvider,
      basicImageModel: normalizeBasicImageModel(row.basicImageModel, imageProvider),
      proImageModel: normalizeProImageModel(row.proImageModel, imageProvider),
      openaiConnectionStatus: row.openaiConnectionStatus as ConnectionStatus,
      falConnectionStatus: row.falConnectionStatus as ConnectionStatus,
      openaiLastTestedAt: row.openaiLastTestedAt?.toISOString() ?? null,
      falLastTestedAt: row.falLastTestedAt?.toISOString() ?? null,
      hasOpenaiApiKey: Boolean(row.openaiApiKey?.trim()),
      hasFalApiKey: Boolean(row.falApiKey?.trim()),
      openaiApiKeyMasked: maskApiKey(row.openaiApiKey),
      falApiKeyMasked: maskApiKey(row.falApiKey),
      features: {
        enableAiAnalysis: row.enableAiAnalysis,
        enableAiThumbnailGeneration: row.enableAiThumbnailGeneration,
        enableAiImproveThumbnail: row.enableAiImproveThumbnail,
        enableAutoCategoryDetection: row.enableAutoCategoryDetection,
        enableThumbnailScoring: row.enableThumbnailScoring,
        enableAutoLayoutDetection: row.enableAutoLayoutDetection,
      },
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getSettings() {
    const row = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const publicSettings = this.toPublic(row);
    return {
      settings: publicSettings,
      mapping: {
        text: {
          provider: publicSettings.textProvider,
          model: publicSettings.textModel,
        },
        image: {
          provider: publicSettings.imageProvider,
          basicModel: publicSettings.basicImageModel,
          proModel: publicSettings.proImageModel,
        },
      },
      envVars: {
        OPENAI_API_KEY: publicSettings.hasOpenaiApiKey ? 'configured in database' : 'not set',
        FAL_API_KEY: publicSettings.hasFalApiKey ? 'configured in database' : 'not set',
        TEXT_PROVIDER: publicSettings.textProvider,
        TEXT_MODEL: publicSettings.textModel,
        IMAGE_PROVIDER: publicSettings.imageProvider,
        BASIC_IMAGE_MODEL: publicSettings.basicImageModel,
        PRO_IMAGE_MODEL: publicSettings.proImageModel,
      },
    };
  }

  async testOpenAi(apiKey: string | undefined, textModel: OpenAiTextModel) {
    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const submitted = apiKey?.trim();
    const key =
      submitted && !isMasked(submitted) ? submitted : current.openaiApiKey?.trim();

    if (!key) {
      throw new BadRequestException('OpenAI API key is required');
    }
    if (!OPENAI_TEXT_MODELS.includes(textModel)) {
      throw new BadRequestException('Invalid OpenAI text model');
    }

    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });

    const ok = res.ok;
    const status: ConnectionStatus = ok ? 'connected' : 'failed';

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        openaiConnectionStatus: status,
        openaiLastTestedAt: new Date(),
      },
    });

    if (!ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(
        `OpenAI connection failed (${res.status})${body ? `: ${body.slice(0, 120)}` : ''}`,
      );
    }

    const verificationToken = this.issueVerificationToken('openai', key);
    return {
      ok: true,
      status,
      verificationToken,
      message: `OpenAI connected. Text model: ${textModel}`,
    };
  }

  async testFal(apiKey: string | undefined) {
    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const submitted = apiKey?.trim();
    const key =
      submitted && !isMasked(submitted) ? submitted : current.falApiKey?.trim();

    if (!key) {
      throw new BadRequestException('fal.ai API key is required');
    }

    const res = await fetch('https://api.fal.ai/v1/models?limit=1', {
      headers: { Authorization: `Key ${key}` },
    });

    const ok = res.ok;
    const status: ConnectionStatus = ok ? 'connected' : 'failed';

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        falConnectionStatus: status,
        falLastTestedAt: new Date(),
      },
    });

    if (!ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(
        `fal.ai connection failed (${res.status})${body ? `: ${body.slice(0, 120)}` : ''}`,
      );
    }

    const verificationToken = this.issueVerificationToken('fal', key);
    return {
      ok: true,
      status,
      verificationToken,
      message: 'fal.ai connection successful',
    };
  }

  private validateImageModels(
    imageProvider: ImageProvider,
    basicImageModel: BasicImageModel,
    proImageModel: ProImageModel,
  ) {
    if (!modelBelongsToImageProvider(basicImageModel, imageProvider)) {
      throw new BadRequestException(
        `Basic model "${basicImageModel}" is not available for ${imageProvider}`,
      );
    }
    if (!modelBelongsToImageProvider(proImageModel, imageProvider)) {
      throw new BadRequestException(
        `Pro model "${proImageModel}" is not available for ${imageProvider}`,
      );
    }
    if (!basicImageModelsForProvider(imageProvider).includes(basicImageModel)) {
      throw new BadRequestException('Invalid basic plan image model');
    }
    if (!proImageModelsForProvider(imageProvider).includes(proImageModel)) {
      throw new BadRequestException('Invalid pro plan image model');
    }
  }

  async saveProviders(data: {
    textModel: OpenAiTextModel;
    imageProvider: ImageProvider;
    basicImageModel: BasicImageModel;
    proImageModel: ProImageModel;
    openaiApiKey?: string;
    openaiVerificationToken?: string;
    falApiKey?: string;
    falVerificationToken?: string;
  }) {
    if (!OPENAI_TEXT_MODELS.includes(data.textModel)) {
      throw new BadRequestException('Text model is required');
    }

    const imageProvider = normalizeImageProvider(data.imageProvider);
    this.validateImageModels(imageProvider, data.basicImageModel, data.proImageModel);

    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });

    const nextOpenAiKey = data.openaiApiKey?.trim();
    const openaiKeyChanging = Boolean(
      nextOpenAiKey && !isMasked(nextOpenAiKey) && nextOpenAiKey !== current.openaiApiKey,
    );

    if (openaiKeyChanging) {
      if (
        !data.openaiVerificationToken ||
        !this.consumeVerificationToken('openai', data.openaiVerificationToken, nextOpenAiKey!)
      ) {
        throw new BadRequestException('Test OpenAI connection before saving a new API key');
      }
    }

    const nextFalKey = data.falApiKey?.trim();
    const falKeyChanging = Boolean(
      nextFalKey && !isMasked(nextFalKey) && nextFalKey !== current.falApiKey,
    );

    if (falKeyChanging) {
      if (
        !data.falVerificationToken ||
        !this.consumeVerificationToken('fal', data.falVerificationToken, nextFalKey!)
      ) {
        throw new BadRequestException('Test fal.ai connection before saving a new API key');
      }
    }

    const openaiKey =
      openaiKeyChanging ? nextOpenAiKey! : current.openaiApiKey?.trim();
    if (imageProvider === 'openai' && !openaiKey) {
      throw new BadRequestException(
        'OpenAI API key is required when OpenAI is the image provider',
      );
    }
    if (imageProvider === 'fal') {
      const falKey = falKeyChanging ? nextFalKey! : current.falApiKey?.trim();
      if (!falKey) {
        throw new BadRequestException(
          'fal.ai API key is required when fal.ai is the image provider',
        );
      }
    }

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        textProvider: 'openai' satisfies TextProvider,
        textModel: data.textModel,
        imageProvider,
        basicImageModel: data.basicImageModel,
        proImageModel: data.proImageModel,
        ...(openaiKeyChanging ? { openaiApiKey: nextOpenAiKey } : {}),
        ...(falKeyChanging ? { falApiKey: nextFalKey } : {}),
      },
    });

    return this.getSettings();
  }

  async saveFeatures(features: {
    enableAiAnalysis?: boolean;
    enableAiThumbnailGeneration?: boolean;
    enableAiImproveThumbnail?: boolean;
    enableAutoCategoryDetection?: boolean;
    enableThumbnailScoring?: boolean;
    enableAutoLayoutDetection?: boolean;
  }) {
    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        enableAiAnalysis: features.enableAiAnalysis ?? current.enableAiAnalysis,
        enableAiThumbnailGeneration:
          features.enableAiThumbnailGeneration ?? current.enableAiThumbnailGeneration,
        enableAiImproveThumbnail:
          features.enableAiImproveThumbnail ?? current.enableAiImproveThumbnail,
        enableAutoCategoryDetection:
          features.enableAutoCategoryDetection ?? current.enableAutoCategoryDetection,
        enableThumbnailScoring:
          features.enableThumbnailScoring ?? current.enableThumbnailScoring,
        enableAutoLayoutDetection:
          features.enableAutoLayoutDetection ?? current.enableAutoLayoutDetection,
      },
    });

    return this.getSettings();
  }

  async getPublicFeatures() {
    const row = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    return {
      enableAiAnalysis: row.enableAiAnalysis,
      enableAiThumbnailGeneration: row.enableAiThumbnailGeneration,
      enableAiImproveThumbnail: row.enableAiImproveThumbnail,
      enableAutoCategoryDetection: row.enableAutoCategoryDetection,
      enableThumbnailScoring: row.enableThumbnailScoring,
      enableAutoLayoutDetection: row.enableAutoLayoutDetection,
    };
  }

  /** Internal use — returns decrypted keys and resolved models for workers. */
  async getCredentials() {
    const row = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const imageProvider = normalizeImageProvider(row.imageProvider);
    const basicImageModel = normalizeBasicImageModel(row.basicImageModel, imageProvider);
    const proImageModel = normalizeProImageModel(row.proImageModel, imageProvider);

    return {
      textProvider: normalizeTextProvider(row.textProvider),
      textModel: normalizeTextModel(row.textModel),
      imageProvider,
      basicImageModel,
      proImageModel,
      openaiApiKey: row.openaiApiKey,
      falApiKey: row.falApiKey,
      /** @deprecated use textModel */
      openaiModel: normalizeTextModel(row.textModel),
      /** @deprecated use basicImageModel */
      basicPlanModel: basicImageModel,
      /** @deprecated use proImageModel */
      proPlanModel: proImageModel,
      features: {
        enableAiAnalysis: row.enableAiAnalysis,
        enableAiThumbnailGeneration: row.enableAiThumbnailGeneration,
        enableAiImproveThumbnail: row.enableAiImproveThumbnail,
        enableAutoCategoryDetection: row.enableAutoCategoryDetection,
        enableThumbnailScoring: row.enableThumbnailScoring,
        enableAutoLayoutDetection: row.enableAutoLayoutDetection,
      },
    };
  }
}
