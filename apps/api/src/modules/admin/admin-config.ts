import type { HdQualityAccessConfig } from '@hellodownloader/shared-types';
import {
  DEFAULT_HD_QUALITY_ACCESS,
  normalizeHdQualityAccess,
} from '@hellodownloader/shared-types';

let retentionHoursOverride: number | null = null;
let downloadQualityAccessOverride: Partial<HdQualityAccessConfig> | null = null;

export const adminRuntimeConfig = {
  getRetentionHours(fallback: number) {
    return retentionHoursOverride ?? fallback;
  },
  setRetentionHours(hours: number) {
    retentionHoursOverride = hours;
  },
  getDownloadQualityAccess(): HdQualityAccessConfig {
    return normalizeHdQualityAccess({
      ...DEFAULT_HD_QUALITY_ACCESS,
      ...downloadQualityAccessOverride,
    });
  },
  setDownloadQualityAccess(patch: Partial<HdQualityAccessConfig>) {
    downloadQualityAccessOverride = {
      ...(downloadQualityAccessOverride ?? {}),
      ...patch,
    };
  },
};
