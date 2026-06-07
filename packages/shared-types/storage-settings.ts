import { isMaskedApiKey, maskApiKey } from './ai-api-settings';

export type StorageSettingsAdmin = {
  r2Enabled: boolean;
  r2AccountId: string;
  r2AccessKeyId: string;
  /** Masked in admin GET unless submitting a new value */
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  videoRetentionHours: number;
  thumbnailRetentionDays: number;
  hasR2SecretAccessKey: boolean;
  r2SecretAccessKeyMasked: string;
};

export type StorageSettingsCredentials = {
  enabled: boolean;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  videoRetentionHours: number;
  thumbnailRetentionDays: number;
};

export const DEFAULT_STORAGE_SETTINGS: StorageSettingsCredentials = {
  enabled: false,
  accountId: '',
  accessKeyId: '',
  secretAccessKey: '',
  bucketName: 'hellodownloader',
  publicUrl: '',
  videoRetentionHours: 1,
  thumbnailRetentionDays: 30,
};

export function normalizeStorageSettings(
  partial?: Partial<StorageSettingsCredentials> | null,
): StorageSettingsCredentials {
  const base = { ...DEFAULT_STORAGE_SETTINGS, ...(partial ?? {}) };
  return {
    enabled: Boolean(base.enabled),
    accountId: normalizeR2AccountId(base.accountId ?? ''),
    accessKeyId: (base.accessKeyId ?? '').trim(),
    secretAccessKey: (base.secretAccessKey ?? '').trim(),
    bucketName: (base.bucketName ?? 'hellodownloader').trim() || 'hellodownloader',
    publicUrl: (base.publicUrl ?? '').trim().replace(/\/+$/, ''),
    videoRetentionHours: Math.max(1, Math.min(168, base.videoRetentionHours ?? 1)),
    thumbnailRetentionDays: Math.max(1, Math.min(365, base.thumbnailRetentionDays ?? 30)),
  };
}

export function toStorageSettingsAdmin(row: StorageSettingsCredentials): StorageSettingsAdmin {
  return {
    r2Enabled: row.enabled,
    r2AccountId: row.accountId,
    r2AccessKeyId: row.accessKeyId,
    r2SecretAccessKey: maskApiKey(row.secretAccessKey),
    r2BucketName: row.bucketName,
    r2PublicUrl: row.publicUrl,
    videoRetentionHours: row.videoRetentionHours,
    thumbnailRetentionDays: row.thumbnailRetentionDays,
    hasR2SecretAccessKey: Boolean(row.secretAccessKey),
    r2SecretAccessKeyMasked: maskApiKey(row.secretAccessKey),
  };
}

export { isMaskedApiKey as isMaskedStorageSecret };

const R2_ACCOUNT_ID_RE = /^[a-f0-9]{32}$/i;
const R2_ENDPOINT_HOST_RE =
  /https?:\/\/([a-f0-9]{32})\.r2\.cloudflarestorage\.com/i;

/** Extract 32-char account id when user pastes the full R2 endpoint URL. */
export function normalizeR2AccountId(value: string): string {
  const trimmed = (value ?? '').trim();
  const fromHost = trimmed.match(R2_ENDPOINT_HOST_RE);
  if (fromHost) return fromHost[1].toLowerCase();
  const hexOnly = trimmed.replace(/[^a-f0-9]/gi, '');
  if (hexOnly.length === 32) return hexOnly.toLowerCase();
  return trimmed;
}

export function isValidR2AccountId(value: string): boolean {
  return R2_ACCOUNT_ID_RE.test(normalizeR2AccountId(value));
}

/** Reject endpoint URLs or public URLs pasted into the secret field. */
export function isInvalidR2SecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isMaskedApiKey(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.includes('r2.cloudflarestorage.com');
}
