import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_STORAGE_SETTINGS,
  isInvalidR2SecretValue,
  isMaskedStorageSecret,
  isValidR2AccountId,
  normalizeR2AccountId,
  normalizeStorageSettings,
  toStorageSettingsAdmin,
  type StorageSettingsAdmin,
  type StorageSettingsCredentials,
} from '@hellodownloader/shared-types';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StorageSettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.importFromEnvIfEmpty();
  }

  private async ensureDefaults() {
    await this.prisma.storageSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        r2Enabled: false,
        r2AccountId: '',
        r2AccessKeyId: '',
        r2SecretAccessKey: '',
        r2BucketName: DEFAULT_STORAGE_SETTINGS.bucketName,
        r2PublicUrl: '',
        videoRetentionHours: DEFAULT_STORAGE_SETTINGS.videoRetentionHours,
        thumbnailRetentionDays: DEFAULT_STORAGE_SETTINGS.thumbnailRetentionDays,
      },
      update: {},
    });
  }

  private async importFromEnvIfEmpty() {
    const row = await this.prisma.storageSettings.findUnique({ where: { id: 1 } });
    if (!row) return;

    const patch: Record<string, string | boolean | number> = {};
    const hasEnvKeys =
      Boolean(process.env.R2_ACCESS_KEY_ID?.trim()) &&
      Boolean(process.env.R2_SECRET_ACCESS_KEY?.trim());

    if (hasEnvKeys && !row.r2AccessKeyId) {
      patch.r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!.trim();
      patch.r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!.trim();
      patch.r2Enabled = true;
    }
    if (!row.r2AccountId && process.env.R2_ACCOUNT_ID?.trim()) {
      patch.r2AccountId = process.env.R2_ACCOUNT_ID.trim();
    }
    if (!row.r2BucketName && process.env.R2_BUCKET_NAME?.trim()) {
      patch.r2BucketName = process.env.R2_BUCKET_NAME.trim();
    }
    if (!row.r2PublicUrl && process.env.R2_PUBLIC_URL?.trim()) {
      patch.r2PublicUrl = process.env.R2_PUBLIC_URL.trim();
    }

    if (Object.keys(patch).length > 0) {
      await this.prisma.storageSettings.update({ where: { id: 1 }, data: patch });
    }
  }

  private rowToCredentials(row: {
    r2Enabled: boolean;
    r2AccountId: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    r2BucketName: string;
    r2PublicUrl: string;
    videoRetentionHours: number;
    thumbnailRetentionDays: number;
  }): StorageSettingsCredentials {
    return normalizeStorageSettings({
      enabled: row.r2Enabled,
      accountId: row.r2AccountId,
      accessKeyId: row.r2AccessKeyId,
      secretAccessKey: row.r2SecretAccessKey,
      bucketName: row.r2BucketName,
      publicUrl: row.r2PublicUrl,
      videoRetentionHours: row.videoRetentionHours,
      thumbnailRetentionDays: row.thumbnailRetentionDays,
    });
  }

  async getCredentials(): Promise<StorageSettingsCredentials> {
    const row = await this.prisma.storageSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      await this.ensureDefaults();
      return this.credentialsFromEnvFallback(DEFAULT_STORAGE_SETTINGS);
    }
    const fromDb = this.rowToCredentials(row);
    return this.credentialsFromEnvFallback(fromDb);
  }

  /** Env vars override DB when set (useful for local dev). */
  private credentialsFromEnvFallback(
    base: StorageSettingsCredentials,
  ): StorageSettingsCredentials {
    const envAccess = process.env.R2_ACCESS_KEY_ID?.trim();
    const envSecret = process.env.R2_SECRET_ACCESS_KEY?.trim();
    if (envAccess && envSecret) {
      return normalizeStorageSettings({
        ...base,
        enabled: true,
        accountId: process.env.R2_ACCOUNT_ID?.trim() || base.accountId,
        accessKeyId: envAccess,
        secretAccessKey: envSecret,
        bucketName: process.env.R2_BUCKET_NAME?.trim() || base.bucketName,
        publicUrl: process.env.R2_PUBLIC_URL?.trim() || base.publicUrl,
      });
    }
    return base;
  }

  async getAdmin(): Promise<StorageSettingsAdmin> {
    const row = await this.prisma.storageSettings.findUnique({ where: { id: 1 } });
    if (!row) {
      await this.ensureDefaults();
      return toStorageSettingsAdmin(DEFAULT_STORAGE_SETTINGS);
    }
    return toStorageSettingsAdmin(this.rowToCredentials(row));
  }

  async updateAdmin(patch: Partial<StorageSettingsAdmin>): Promise<StorageSettingsAdmin> {
    const current = await this.getAdmin();
    const currentCreds = await this.getCredentialsFromDbOnly();

    if (
      patch.r2SecretAccessKey !== undefined &&
      patch.r2SecretAccessKey.trim() &&
      !isMaskedStorageSecret(patch.r2SecretAccessKey) &&
      isInvalidR2SecretValue(patch.r2SecretAccessKey)
    ) {
      throw new BadRequestException(
        'Secret Access Key must be the token secret from Cloudflare, not the R2 endpoint URL.',
      );
    }

    if (
      patch.r2AccountId !== undefined &&
      patch.r2AccountId.trim() &&
      !isValidR2AccountId(patch.r2AccountId)
    ) {
      throw new BadRequestException(
        'Account ID must be a 32-character hex value from Cloudflare → R2 → Account ID.',
      );
    }

    const nextSecret =
      patch.r2SecretAccessKey !== undefined &&
      patch.r2SecretAccessKey.trim() &&
      !isMaskedStorageSecret(patch.r2SecretAccessKey)
        ? patch.r2SecretAccessKey.trim()
        : currentCreds.secretAccessKey;

    const next = normalizeStorageSettings({
      enabled: patch.r2Enabled ?? current.r2Enabled,
      accountId: normalizeR2AccountId(patch.r2AccountId ?? current.r2AccountId),
      accessKeyId: patch.r2AccessKeyId ?? current.r2AccessKeyId,
      secretAccessKey: nextSecret,
      bucketName: patch.r2BucketName ?? current.r2BucketName,
      publicUrl: patch.r2PublicUrl ?? current.r2PublicUrl,
      videoRetentionHours: patch.videoRetentionHours ?? current.videoRetentionHours,
      thumbnailRetentionDays: patch.thumbnailRetentionDays ?? current.thumbnailRetentionDays,
    });

    await this.prisma.storageSettings.update({
      where: { id: 1 },
      data: {
        r2Enabled: next.enabled,
        r2AccountId: next.accountId,
        r2AccessKeyId: next.accessKeyId,
        r2SecretAccessKey: next.secretAccessKey,
        r2BucketName: next.bucketName,
        r2PublicUrl: next.publicUrl,
        videoRetentionHours: next.videoRetentionHours,
        thumbnailRetentionDays: next.thumbnailRetentionDays,
      },
    });

    return this.getAdmin();
  }

  private async getCredentialsFromDbOnly(): Promise<StorageSettingsCredentials> {
    const row = await this.prisma.storageSettings.findUniqueOrThrow({ where: { id: 1 } });
    return this.rowToCredentials(row);
  }

  isR2Configured(credentials: StorageSettingsCredentials): boolean {
    return Boolean(
      credentials.enabled &&
        credentials.accountId &&
        credentials.accessKeyId &&
        credentials.secretAccessKey &&
        credentials.bucketName,
    );
  }
}
