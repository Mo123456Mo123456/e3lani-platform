import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export const QUEUE_NAMES = {
  MEDIA: 'e3lani-media',
  NOTIFICATIONS: 'e3lani-notifications',
  MAINTENANCE: 'e3lani-maintenance',
} as const;

export interface MediaJobPayload {
  mediaId: string;
  key: string;
  type: 'IMAGE' | 'VIDEO';
  purpose: string;
}

export interface NotificationJobPayload {
  userId: string;
  type: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly connectionUrl: string;

  constructor(config: ConfigService) {
    this.connectionUrl = config.getOrThrow<string>('REDIS_URL');
  }

  private queue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: { url: this.connectionUrl } as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 3_600, count: 500 },
          removeOnFail: { age: 86_400 },
        },
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueueMediaProcessing(payload: MediaJobPayload): Promise<void> {
    await this.queue(QUEUE_NAMES.MEDIA).add('process-media', payload, { jobId: payload.mediaId });
    this.logger.debug(`تمت جدولة معالجة الوسيط ${payload.mediaId}`);
  }

  async enqueueNotification(payload: NotificationJobPayload): Promise<void> {
    await this.queue(QUEUE_NAMES.NOTIFICATIONS).add('push', payload);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close().catch(() => undefined)));
    this.queues.clear();
  }
}
