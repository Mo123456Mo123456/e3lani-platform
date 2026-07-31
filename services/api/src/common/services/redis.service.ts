import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    this.client.on('error', (error) => this.logger.error(`Redis: ${error.message}`));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    await this.client.set(key, value, 'EX', seconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** عدّاد نافذة منزلقة بسيط يُستخدم في الحد من المعدل. */
  async increment(key: string, windowSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, windowSeconds);
    return count;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, seconds: number): Promise<void> {
    await this.setEx(key, seconds, JSON.stringify(value));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
