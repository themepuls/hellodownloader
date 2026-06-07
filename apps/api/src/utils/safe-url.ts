import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
]);

function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (normalized === '127.0.0.1' || normalized === '::1') return true;
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (normalized.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80')) {
    return true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host.includes('169.254.')) return true;
  const ipVersion = isIP(host);
  if (ipVersion && isPrivateIpAddress(host)) return true;
  return false;
}

export function parsePublicHttpUrl(raw: string, label = 'URL'): URL {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${label} is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException(`Invalid ${label.toLowerCase()}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(`${label} must use http or https`);
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestException(`${label} must not include credentials`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new BadRequestException(`${label} host is not allowed`);
  }

  return parsed;
}

export function assertSafeVideoUrl(raw: string): string {
  return parsePublicHttpUrl(raw, 'Video URL').toString();
}

const ALLOWED_THUMBNAIL_HOST =
  /(?:^|\.)youtube\.com$|(?:^|\.)ytimg\.com$|(?:^|\.)googleusercontent\.com$|(?:^|\.)instagram\.com$|(?:^|\.)cdninstagram\.com$|(?:^|\.)fbcdn\.net$|(?:^|\.)facebook\.com$|(?:^|\.)tiktokcdn\.com$|(?:^|\.)tiktok\.com$|(?:^|\.)twimg\.com$|(?:^|\.)vimeocdn\.com$|(?:^|\.)vimeo\.com$/i;

export function assertAllowedThumbnailUrl(raw: string): string {
  const parsed = parsePublicHttpUrl(raw, 'Thumbnail URL');
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Thumbnail URL must use https');
  }
  if (!ALLOWED_THUMBNAIL_HOST.test(parsed.hostname)) {
    throw new BadRequestException('Thumbnail host is not allowed');
  }
  return parsed.toString();
}

export function isAllowedThumbnailHost(hostname: string): boolean {
  return ALLOWED_THUMBNAIL_HOST.test(hostname);
}

export function sanitizeHttpLinkUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}
