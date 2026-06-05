import { Injectable, OnModuleInit } from '@nestjs/common';
import { PaymentProvider } from '@hellodownloader/database';
import { PrismaService } from '../database/prisma.service';

export type GatewayMode = 'TEST' | 'LIVE';

export type StripeSecrets = {
  testSecretKey?: string;
  testWebhookSecret?: string;
  testPriceId?: string;
  liveSecretKey?: string;
  liveWebhookSecret?: string;
  livePriceId?: string;
};

export type BinanceSecrets = {
  testApiKey?: string;
  testSecretKey?: string;
  liveApiKey?: string;
  liveSecretKey?: string;
};

export type SslcommerzSecrets = {
  testStoreId?: string;
  testStorePass?: string;
  liveStoreId?: string;
  liveStorePass?: string;
};

type ProviderSecrets = StripeSecrets | BinanceSecrets | SslcommerzSecrets;

export type PaymentProviderRow = {
  provider: PaymentProvider;
  enabled: boolean;
  mode: GatewayMode;
  amount: number;
  currency: string;
  secrets: ProviderSecrets;
  configured: boolean;
};

const DEFAULTS: Array<Omit<PaymentProviderRow, 'configured'>> = [
  {
    provider: 'STRIPE',
    enabled: false,
    mode: 'TEST',
    amount: 9.99,
    currency: 'USD',
    secrets: {},
  },
  {
    provider: 'BINANCE',
    enabled: false,
    mode: 'TEST',
    amount: 9.99,
    currency: 'USDT',
    secrets: {},
  },
  {
    provider: 'SSLCOMMERZ',
    enabled: false,
    mode: 'TEST',
    amount: 1099,
    currency: 'BDT',
    secrets: {},
  },
];

function mask(value?: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

@Injectable()
export class PaymentConfigService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.importFromEnvIfEmpty();
  }

  async ensureDefaults() {
    for (const row of DEFAULTS) {
      await this.prisma.paymentProviderConfig.upsert({
        where: { provider: row.provider },
        create: {
          provider: row.provider,
          enabled: row.enabled,
          mode: row.mode,
          amount: row.amount,
          currency: row.currency,
          secrets: row.secrets as object,
        },
        update: {},
      });
    }
  }

  /** One-time import from .env when DB keys are empty (dev migration). */
  private async importFromEnvIfEmpty() {
    const stripe = await this.getRaw('STRIPE');
    const s = stripe.secrets as StripeSecrets;
    if (!s.testSecretKey && process.env.STRIPE_SECRET_KEY) {
      await this.mergeSecrets('STRIPE', {
        testSecretKey: process.env.STRIPE_SECRET_KEY,
        testWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        testPriceId: process.env.STRIPE_PRO_PRICE_ID,
      });
    }
    const binance = await this.getRaw('BINANCE');
    const b = binance.secrets as BinanceSecrets;
    if (!b.testApiKey && process.env.BINANCE_API_KEY) {
      await this.mergeSecrets('BINANCE', {
        testApiKey: process.env.BINANCE_API_KEY,
        testSecretKey: process.env.BINANCE_SECRET_KEY,
      });
    }
    const ssl = await this.getRaw('SSLCOMMERZ');
    const sl = ssl.secrets as SslcommerzSecrets;
    if (!sl.testStoreId && process.env.SSLCOMMERZ_STORE_ID) {
      await this.mergeSecrets('SSLCOMMERZ', {
        testStoreId: process.env.SSLCOMMERZ_STORE_ID,
        testStorePass: process.env.SSLCOMMERZ_STORE_PASSWD,
      });
      if (process.env.SSLCOMMERZ_IS_LIVE === 'true') {
        await this.update('SSLCOMMERZ', { mode: 'LIVE' });
      }
    }
  }

  private async getRaw(provider: PaymentProvider) {
    const row = await this.prisma.paymentProviderConfig.findUniqueOrThrow({
      where: { provider },
    });
    return {
      provider: row.provider as PaymentProvider,
      enabled: row.enabled,
      mode: row.mode as GatewayMode,
      amount: row.amount,
      currency: row.currency,
      secrets: (row.secrets ?? {}) as ProviderSecrets,
    };
  }

  isConfigured(row: {
    provider: PaymentProvider;
    mode: GatewayMode;
    secrets: ProviderSecrets;
  }): boolean {
    const { provider, mode, secrets } = row;
    if (provider === 'STRIPE') {
      const s = secrets as StripeSecrets;
      return mode === 'LIVE'
        ? Boolean(s.liveSecretKey && s.livePriceId)
        : Boolean(s.testSecretKey && s.testPriceId);
    }
    if (provider === 'BINANCE') {
      const s = secrets as BinanceSecrets;
      return mode === 'LIVE'
        ? Boolean(s.liveApiKey && s.liveSecretKey)
        : Boolean(s.testApiKey && s.testSecretKey);
    }
    const s = secrets as SslcommerzSecrets;
    return mode === 'LIVE'
      ? Boolean(s.liveStoreId && s.liveStorePass)
      : Boolean(s.testStoreId && s.testStorePass);
  }

  async get(provider: PaymentProvider): Promise<PaymentProviderRow> {
    const row = await this.getRaw(provider);
    return { ...row, configured: this.isConfigured(row) };
  }

  async getAll(): Promise<PaymentProviderRow[]> {
    const rows = await Promise.all(
      (['STRIPE', 'BINANCE', 'SSLCOMMERZ'] as PaymentProvider[]).map((p) => this.get(p)),
    );
    return rows;
  }

  /** Admin API — secrets masked. */
  async getAllForAdmin() {
    const rows = await this.getAll();
    return rows.map((r) => ({
      ...r,
      secrets: this.maskSecrets(r.provider, r.secrets),
    }));
  }

  maskSecrets(provider: PaymentProvider, secrets: ProviderSecrets) {
    if (provider === 'STRIPE') {
      const s = secrets as StripeSecrets;
      return {
        testSecretKey: mask(s.testSecretKey),
        testWebhookSecret: mask(s.testWebhookSecret),
        testPriceId: s.testPriceId ?? '',
        liveSecretKey: mask(s.liveSecretKey),
        liveWebhookSecret: mask(s.liveWebhookSecret),
        livePriceId: s.livePriceId ?? '',
        hasTestSecretKey: Boolean(s.testSecretKey),
        hasTestWebhookSecret: Boolean(s.testWebhookSecret),
        hasLiveSecretKey: Boolean(s.liveSecretKey),
        hasLiveWebhookSecret: Boolean(s.liveWebhookSecret),
      };
    }
    if (provider === 'BINANCE') {
      const s = secrets as BinanceSecrets;
      return {
        testApiKey: mask(s.testApiKey),
        testSecretKey: mask(s.testSecretKey),
        liveApiKey: mask(s.liveApiKey),
        liveSecretKey: mask(s.liveSecretKey),
        hasTestApiKey: Boolean(s.testApiKey),
        hasTestSecretKey: Boolean(s.testSecretKey),
        hasLiveApiKey: Boolean(s.liveApiKey),
        hasLiveSecretKey: Boolean(s.liveSecretKey),
      };
    }
    const s = secrets as SslcommerzSecrets;
    return {
      testStoreId: s.testStoreId ?? '',
      testStorePass: mask(s.testStorePass),
      liveStoreId: s.liveStoreId ?? '',
      liveStorePass: mask(s.liveStorePass),
      hasTestStorePass: Boolean(s.testStorePass),
      hasLiveStorePass: Boolean(s.liveStorePass),
    };
  }

  async mergeSecrets(provider: PaymentProvider, patch: ProviderSecrets) {
    const current = await this.getRaw(provider);
    const merged = { ...current.secrets, ...patch };
    await this.prisma.paymentProviderConfig.update({
      where: { provider },
      data: { secrets: merged as object },
    });
  }

  async update(
    provider: PaymentProvider,
    data: {
      enabled?: boolean;
      mode?: GatewayMode;
      amount?: number;
      currency?: string;
      secrets?: ProviderSecrets;
    },
  ) {
    const current = await this.getRaw(provider);
    const secrets = data.secrets
      ? this.mergeSecretPatch(current.secrets, data.secrets)
      : current.secrets;

    await this.prisma.paymentProviderConfig.update({
      where: { provider },
      data: {
        enabled: data.enabled ?? current.enabled,
        mode: data.mode ?? current.mode,
        amount: data.amount ?? current.amount,
        currency: data.currency ?? current.currency,
        secrets: secrets as object,
      },
    });

    return this.getForAdmin(provider);
  }

  /** Skip empty strings; keep existing secret if patch is blank or masked. */
  private mergeSecretPatch(existing: ProviderSecrets, patch: ProviderSecrets): ProviderSecrets {
    const out = { ...existing } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') continue;
      if (typeof v === 'string' && v.includes('•')) continue;
      out[k] = v;
    }
    return out as ProviderSecrets;
  }

  async getForAdmin(provider: PaymentProvider) {
    const row = await this.get(provider);
    return {
      ...row,
      secrets: this.maskSecrets(provider, row.secrets),
    };
  }

  getStripeCredentials(row: PaymentProviderRow) {
    const s = row.secrets as StripeSecrets;
    return row.mode === 'LIVE'
      ? {
          secretKey: s.liveSecretKey,
          webhookSecret: s.liveWebhookSecret,
          priceId: s.livePriceId,
        }
      : {
          secretKey: s.testSecretKey,
          webhookSecret: s.testWebhookSecret,
          priceId: s.testPriceId,
        };
  }

  getBinanceCredentials(row: PaymentProviderRow) {
    const s = row.secrets as BinanceSecrets;
    return row.mode === 'LIVE'
      ? { apiKey: s.liveApiKey, secretKey: s.liveSecretKey }
      : { apiKey: s.testApiKey, secretKey: s.testSecretKey };
  }

  getSslcommerzCredentials(row: PaymentProviderRow) {
    const s = row.secrets as SslcommerzSecrets;
    return row.mode === 'LIVE'
      ? { storeId: s.liveStoreId, storePass: s.liveStorePass, isLive: true }
      : { storeId: s.testStoreId, storePass: s.testStorePass, isLive: false };
  }
}
