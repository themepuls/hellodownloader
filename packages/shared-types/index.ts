export * from './platforms';
export * from './site-content';
export * from './ai-api-settings';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum DownloadStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PlanType {
  FREE = 'FREE',
  PRO = 'PRO',
}

export enum DownloadType {
  VIDEO = 'VIDEO',
  PLAYLIST = 'PLAYLIST',
  SHORTS = 'SHORTS',
  REEL_FACEBOOK = 'REEL_FACEBOOK',
  REEL_INSTAGRAM = 'REEL_INSTAGRAM',
  MP3 = 'MP3',
  SUBTITLE = 'SUBTITLE',
  ZIP = 'ZIP',
}

export enum ThumbnailRatio {
  YOUTUBE_16_9 = 'YOUTUBE_16_9',
  SHORTS_9_16 = 'SHORTS_9_16',
  INSTAGRAM_4_5 = 'INSTAGRAM_4_5',
  FACEBOOK_1_1 = 'FACEBOOK_1_1',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  BINANCE = 'BINANCE',
  SSLCOMMERZ = 'SSLCOMMERZ',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum QueueName {
  DOWNLOAD = 'download',
  THUMBNAIL = 'thumbnail',
  VIDEO = 'video',
  CLEANUP = 'cleanup',
}

export const CREDIT_COSTS = {
  THUMBNAIL_AI_ADJUST: 1,
  THUMBNAIL_AI_GENERATE: 3,
  EXPORT_4K: 3,
} as const;

/** @deprecated use THUMBNAIL_AI_ADJUST */
export const THUMBNAIL_RESIZE_CREDIT = CREDIT_COSTS.THUMBNAIL_AI_ADJUST;

export const PLAN_LIMITS = {
  FREE: {
    maxResolution: 720,
    ads: true,
    playlistZip: true,
    originalThumbnail: true,
    audioDownload: true,
    subtitleDownload: true,
    historyDays: 7,
    aiThumbnailAdjust: false,
    aiThumbnailGenerate: false,
    multipleThumbnailRatios: false,
  },
  PRO: {
    maxResolution: 4320,
    ads: false,
    playlistZip: true,
    originalThumbnail: true,
    audioDownload: true,
    subtitleDownload: true,
    historyDays: null as number | null,
    aiThumbnailAdjust: true,
    aiThumbnailGenerate: true,
    multipleThumbnailRatios: true,
  },
} as const;

export function getHistorySince(plan: PlanType): Date | undefined {
  const days = PLAN_LIMITS[plan].historyDays;
  if (days == null) return undefined;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  plan: PlanType;
}

export interface DownloadJobData {
  downloadId: string;
  userId: string;
  url: string;
  type: DownloadType;
  format?: string;
  quality?: number;
  plan: PlanType;
}

export interface ThumbnailJobData {
  thumbnailId: string;
  userId: string;
  videoUrl: string;
  ratio: ThumbnailRatio;
  upscale?: boolean;
  mode?: 'adjust' | 'generate';
  prompt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
