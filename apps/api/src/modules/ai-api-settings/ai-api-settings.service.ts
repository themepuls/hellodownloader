import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BASIC_PLAN_MODELS,
  DEFAULT_AI_API_SETTINGS,
  OPENAI_MODELS,
  PRO_PLAN_MODELS,
  normalizeBasicPlanModel,
  normalizeProPlanModel,
  type AiApiSettingsPublic,
  type BasicPlanModel,
  type ConnectionStatus,
  type OpenAiModel,
  type ProPlanModel,
} from '@hellodownloader/shared-types';

type Provider = 'openai' | 'freepik';

type VerificationEntry = {
  provider: Provider;
  apiKey: string;
  expiresAt: number;
};

function maskKey(value?: string): string {
  if (!value?.trim()) return '';
  const v = value.trim();
  if (v.length <= 8) return '••••••••';
  return `${'•'.repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

function isMasked(value: string): boolean {
  return value.includes('•');
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
        openaiModel: DEFAULT_AI_API_SETTINGS.openaiModel,
        basicPlanModel: DEFAULT_AI_API_SETTINGS.basicPlanModel,
        proPlanModel: DEFAULT_AI_API_SETTINGS.proPlanModel,
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
    if (!row.freepikApiKey && process.env.FREEPIK_API_KEY?.trim()) {
      patch.freepikApiKey = process.env.FREEPIK_API_KEY.trim();
    }
    if (process.env.OPENAI_MODEL?.trim() && OPENAI_MODELS.includes(process.env.OPENAI_MODEL as OpenAiModel)) {
      patch.openaiModel = process.env.OPENAI_MODEL.trim();
    }
    if (
      process.env.BASIC_PLAN_MODEL?.trim() &&
      BASIC_PLAN_MODELS.includes(process.env.BASIC_PLAN_MODEL as BasicPlanModel)
    ) {
      patch.basicPlanModel = process.env.BASIC_PLAN_MODEL.trim();
    }
    if (
      process.env.PRO_PLAN_MODEL?.trim() &&
      PRO_PLAN_MODELS.includes(process.env.PRO_PLAN_MODEL as ProPlanModel)
    ) {
      patch.proPlanModel = process.env.PRO_PLAN_MODEL.trim();
    }

    if (Object.keys(patch).length > 0) {
      await this.prisma.aiApiSettings.update({ where: { id: 1 }, data: patch });
    }
  }

  private consumeVerificationToken(provider: Provider, token: string, apiKey: string) {
    const entry = this.verificationTokens.get(token);
    this.verificationTokens.delete(token);
    if (!entry) return false;
    if (entry.provider !== provider) return false;
    if (entry.apiKey !== apiKey) return false;
    if (Date.now() > entry.expiresAt) return false;
    return true;
  }

  private issueVerificationToken(provider: Provider, apiKey: string) {
    const token = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.verificationTokens.set(token, {
      provider,
      apiKey,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return token;
  }

  private toPublic(row: {
    openaiApiKey: string;
    openaiModel: string;
    openaiConnectionStatus: string;
    openaiLastTestedAt: Date | null;
    freepikApiKey: string;
    freepikConnectionStatus: string;
    freepikLastTestedAt: Date | null;
    basicPlanModel: string;
    proPlanModel: string;
    enableAiAnalysis: boolean;
    enableAiThumbnailGeneration: boolean;
    enableAiImproveThumbnail: boolean;
    enableAutoCategoryDetection: boolean;
    enableThumbnailScoring: boolean;
    enableAutoLayoutDetection: boolean;
    updatedAt: Date;
  }): AiApiSettingsPublic {
    return {
      openaiModel: row.openaiModel as OpenAiModel,
      basicPlanModel: normalizeBasicPlanModel(row.basicPlanModel),
      proPlanModel: normalizeProPlanModel(row.proPlanModel),
      openaiConnectionStatus: row.openaiConnectionStatus as ConnectionStatus,
      freepikConnectionStatus: row.freepikConnectionStatus as ConnectionStatus,
      openaiLastTestedAt: row.openaiLastTestedAt?.toISOString() ?? null,
      freepikLastTestedAt: row.freepikLastTestedAt?.toISOString() ?? null,
      hasOpenaiApiKey: Boolean(row.openaiApiKey?.trim()),
      hasFreepikApiKey: Boolean(row.freepikApiKey?.trim()),
      openaiApiKeyMasked: maskKey(row.openaiApiKey),
      freepikApiKeyMasked: maskKey(row.freepikApiKey),
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
        basicPlan: { label: 'Basic Plan (Free)', model: publicSettings.basicPlanModel },
        proPlan: { label: 'Pro Plan', model: publicSettings.proPlanModel },
        openai: { label: 'OpenAI', model: publicSettings.openaiModel },
      },
      envVars: {
        OPENAI_API_KEY: publicSettings.hasOpenaiApiKey ? 'configured in database' : 'not set',
        FREEPIK_API_KEY: publicSettings.hasFreepikApiKey ? 'configured in database' : 'not set',
        OPENAI_MODEL: publicSettings.openaiModel,
        BASIC_PLAN_MODEL: publicSettings.basicPlanModel,
        PRO_PLAN_MODEL: publicSettings.proPlanModel,
      },
    };
  }

  async testOpenAi(apiKey: string, model: OpenAiModel) {
    if (!apiKey?.trim()) {
      throw new BadRequestException('OpenAI API key is required');
    }
    if (!OPENAI_MODELS.includes(model)) {
      throw new BadRequestException('Invalid OpenAI model');
    }

    const key = apiKey.trim();
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
      message: `Connected successfully. Model configured: ${model}`,
    };
  }

  async testFreepik(apiKey: string) {
    if (!apiKey?.trim()) {
      throw new BadRequestException('Freepik API key is required');
    }

    const key = apiKey.trim();
    const res = await fetch('https://api.freepik.com/v1/resources?limit=1', {
      headers: { 'x-freepik-api-key': key },
    });

    const ok = res.ok;
    const status: ConnectionStatus = ok ? 'connected' : 'failed';

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        freepikConnectionStatus: status,
        freepikLastTestedAt: new Date(),
      },
    });

    if (!ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(
        `Freepik connection failed (${res.status})${body ? `: ${body.slice(0, 120)}` : ''}`,
      );
    }

    const verificationToken = this.issueVerificationToken('freepik', key);
    return {
      ok: true,
      status,
      verificationToken,
      message: 'Freepik connection successful',
    };
  }

  async saveOpenAi(data: {
    apiKey?: string;
    openaiModel: OpenAiModel;
    verificationToken?: string;
  }) {
    if (!OPENAI_MODELS.includes(data.openaiModel)) {
      throw new BadRequestException('OpenAI model is required');
    }

    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const nextKey = data.apiKey?.trim();
    const keyChanging = Boolean(nextKey && !isMasked(nextKey) && nextKey !== current.openaiApiKey);

    if (keyChanging) {
      if (!nextKey) throw new BadRequestException('OpenAI API key is required');
      if (
        !data.verificationToken ||
        !this.consumeVerificationToken('openai', data.verificationToken, nextKey)
      ) {
        throw new BadRequestException('Test OpenAI connection before saving a new API key');
      }
    } else if (!current.openaiApiKey?.trim()) {
      throw new BadRequestException('OpenAI API key is required');
    }

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        openaiModel: data.openaiModel,
        ...(keyChanging ? { openaiApiKey: nextKey } : {}),
      },
    });

    return this.getSettings();
  }

  async saveFreepik(data: { apiKey?: string; verificationToken?: string }) {
    const current = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    const nextKey = data.apiKey?.trim();
    const keyChanging = Boolean(nextKey && !isMasked(nextKey) && nextKey !== current.freepikApiKey);

    if (keyChanging) {
      if (!nextKey) throw new BadRequestException('Freepik API key is required');
      if (
        !data.verificationToken ||
        !this.consumeVerificationToken('freepik', data.verificationToken, nextKey)
      ) {
        throw new BadRequestException('Test Freepik connection before saving a new API key');
      }
    } else if (!current.freepikApiKey?.trim()) {
      throw new BadRequestException('Freepik API key is required');
    }

    if (keyChanging) {
      await this.prisma.aiApiSettings.update({
        where: { id: 1 },
        data: { freepikApiKey: nextKey },
      });
    }

    return this.getSettings();
  }

  async savePlanModels(data: {
    basicPlanModel: BasicPlanModel;
    proPlanModel: ProPlanModel;
  }) {
    if (!BASIC_PLAN_MODELS.includes(data.basicPlanModel)) {
      throw new BadRequestException('Basic plan model is required');
    }
    if (!PRO_PLAN_MODELS.includes(data.proPlanModel)) {
      throw new BadRequestException('Pro plan model is required');
    }

    await this.prisma.aiApiSettings.update({
      where: { id: 1 },
      data: {
        basicPlanModel: data.basicPlanModel,
        proPlanModel: data.proPlanModel,
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

  /** Internal use — returns decrypted keys for workers. */
  async getCredentials() {
    const row = await this.prisma.aiApiSettings.findUniqueOrThrow({ where: { id: 1 } });
    return {
      openaiApiKey: row.openaiApiKey,
      openaiModel: row.openaiModel as OpenAiModel,
      freepikApiKey: row.freepikApiKey,
      basicPlanModel: normalizeBasicPlanModel(row.basicPlanModel),
      proPlanModel: normalizeProPlanModel(row.proPlanModel),
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
