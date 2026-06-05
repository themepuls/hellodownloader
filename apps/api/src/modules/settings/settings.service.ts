import { Injectable } from '@nestjs/common';

export interface UserSettings {
  defaultQuality: number;
  defaultFormat: string;
  emailNotifications: boolean;
  autoSaveHistory: boolean;
  theme: 'light' | 'dark' | 'system';
}

const DEFAULTS: UserSettings = {
  defaultQuality: 720,
  defaultFormat: 'mp4',
  emailNotifications: true,
  autoSaveHistory: true,
  theme: 'system',
};

// In-memory settings store keyed by userId. Replace with a DB-backed table
// (add a `UserSettings` model to schema.prisma) for multi-instance deployments.
const settingsCache = new Map<string, UserSettings>();

@Injectable()
export class SettingsService {
  async get(userId: string): Promise<UserSettings> {
    return settingsCache.get(userId) ?? { ...DEFAULTS };
  }

  async update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get(userId);
    const next = { ...current, ...patch };
    settingsCache.set(userId, next);
    return next;
  }
}
