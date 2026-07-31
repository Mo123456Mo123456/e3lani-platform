import { Injectable } from '@nestjs/common';
import { DEFAULT_SETTINGS, SETTING_KEYS, type PublishingMode, type SettingKey } from '@e3lani/config';
import { PrismaService } from './prisma.service';

const CACHE_TTL_MS = 15_000;

/**
 * إعدادات التشغيل المخزّنة في قاعدة البيانات وقابلة للتعديل من لوحة الإدارة.
 * لا يوجد أي سلوك تشغيلي مكتوب بشكل صلب داخل الكود.
 */
@Injectable()
export class SettingsService {
  private cache: Record<string, unknown> | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  private async load(): Promise<Record<string, unknown>> {
    if (this.cache && Date.now() - this.cachedAt < CACHE_TTL_MS) return this.cache;
    const rows = await this.prisma.appSetting.findMany();
    const values: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) values[row.key] = row.value;
    this.cache = values;
    this.cachedAt = Date.now();
    return values;
  }

  invalidate(): void {
    this.cache = null;
  }

  async all(): Promise<Record<string, unknown>> {
    return this.load();
  }

  async get<T = unknown>(key: SettingKey | string, fallback?: T): Promise<T> {
    const values = await this.load();
    return (values[key] as T) ?? (fallback as T);
  }

  async publishingMode(): Promise<PublishingMode> {
    const value = await this.get<PublishingMode>(SETTING_KEYS.PUBLISHING_MODE, 'FREE');
    return value === 'PAID' ? 'PAID' : 'FREE';
  }

  async paymentsEnabled(): Promise<boolean> {
    return Boolean(await this.get<boolean>(SETTING_KEYS.PAYMENTS_ENABLED, false));
  }

  async tickerEnabled(): Promise<boolean> {
    return Boolean(await this.get<boolean>(SETTING_KEYS.TICKER_ENABLED, true));
  }

  async autoModerationEnabled(): Promise<boolean> {
    return Boolean(await this.get<boolean>(SETTING_KEYS.AUTO_MODERATION_ENABLED, true));
  }

  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value: value as any, updatedBy },
      create: { key, value: value as any, updatedBy },
    });
    this.invalidate();
  }
}
