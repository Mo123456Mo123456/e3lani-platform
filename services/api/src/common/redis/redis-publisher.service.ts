import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export interface RealtimeDelta {
  type: "event" | "tick" | "contribution" | "notification" | "ai_status" | "layer";
  planetId: string;
  tick?: number;
  payload: Record<string, unknown>;
  ts: string;
}

@Injectable()
export class RedisPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private client?: Redis;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>("redisUrl");
    if (!redisUrl) {
      this.logger.warn("REDIS_URL is not set; realtime deltas will be skipped");
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.client.on("error", (error) => {
      this.connected = false;
      this.logger.warn(`Redis publisher error: ${error.message}`);
    });

    try {
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      this.logger.warn(
        `Redis publisher could not connect: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  async publishDelta(delta: Omit<RealtimeDelta, "ts"> & { ts?: string }): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    const payload: RealtimeDelta = {
      ...delta,
      ts: delta.ts ?? new Date().toISOString(),
    };

    try {
      await this.client.publish("planet:deltas", JSON.stringify(payload));
    } catch (error) {
      this.logger.warn(
        `Failed to publish realtime delta: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isHealthy(): boolean {
    return this.connected;
  }
}
