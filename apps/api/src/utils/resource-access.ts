import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const TOKEN_BYTES = 32;

export function generateResourceAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export function hashResourceAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyResourceAccessToken(storedHash: string | undefined, token: string | undefined): boolean {
  if (!storedHash || !token) return false;
  const candidate = hashResourceAccessToken(token);
  try {
    return timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch {
    return false;
  }
}

export function readAccessTokenHash(
  metadata: unknown,
  field = 'accessTokenHash',
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function withAccessTokenHash<T extends Record<string, unknown>>(
  metadata: T,
  tokenHash: string,
): T & { accessTokenHash: string } {
  return { ...metadata, accessTokenHash: tokenHash };
}
