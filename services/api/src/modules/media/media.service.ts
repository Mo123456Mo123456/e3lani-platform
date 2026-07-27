import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { MEDIA_LIMITS } from '@e3lani/config';
import { validateMediaIntent } from '@e3lani/validation';
import {
  assertAllowedStorageKey,
  buildObjectKey,
  checkStorageHealth,
  createSignedUpload,
  createStorageClientFromEnv,
  ensureBucketOrCreate,
  objectExists,
  resolveStorageEnv,
  storageHealthSummary,
  type StorageConfig,
  type StorageHealthResult,
} from '@e3lani/storage';
import type { S3Client } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { decorateAsset } from '../../common/media-urls';
import { processMediaInline, shouldProcessMediaInline } from './inline-processor';

/** MediaAsset.status lifecycle used by API + worker. */
export const MEDIA_STATUSES = [
  'UPLOADING',
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
] as const;

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly log = new Logger(MediaService.name);
  private client: S3Client | null = null;
  private config: StorageConfig | null = null;
  private redis: Redis | null = null;
  private lastHealth: StorageHealthResult | null = null;
  private inlineProcessing = shouldProcessMediaInline();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.inlineProcessing = shouldProcessMediaInline();
    const resolved = createStorageClientFromEnv();
    if (resolved) {
      this.client = resolved.client;
      this.config = resolved.config;
      try {
        await ensureBucketOrCreate(
          this.client,
          this.config.bucket,
          this.config.provider,
        );
        this.log.log(
          `Storage ready provider=${this.config.provider} bucket=${this.config.bucket} private=${this.config.privateBucket} mediaMode=${this.inlineProcessing ? 'inline' : 'queue'}`,
        );
      } catch (error) {
        const name = error instanceof Error ? error.message : 'unknown';
        this.log.warn(`Storage bucket check failed (${name}) — uploads will report unhealthy`);
      }
    } else {
      const status = resolveStorageEnv();
      this.log.warn(
        `Storage not ready mode=${status.mode} missing=${status.missing.join(',') || 'none'}`,
      );
    }

    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      try {
        await this.redis.connect();
      } catch {
        this.redis = null;
      }
    }
  }

  storageSummary() {
    return storageHealthSummary();
  }

  async storageHealth(): Promise<StorageHealthResult> {
    this.lastHealth = await checkStorageHealth();
    return this.lastHealth;
  }

  private storageBinding() {
    if (!this.client || !this.config) return null;
    return { client: this.client, config: this.config };
  }

  async createUploadIntent(
    ownerId: string,
    input: {
      kind: 'image' | 'video';
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number;
      adId?: string;
      fileName?: string;
    },
  ) {
    this.requireStorageConfigured();

    let normalized: ReturnType<typeof validateMediaIntent>;
    try {
      normalized = validateMediaIntent({
        kind: input.kind,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        durationSeconds: input.durationSeconds,
        fileName: input.fileName,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const key = buildObjectKey({
      ownerId,
      kind: normalized.kind,
      mimeType: normalized.mimeType,
    });
    assertAllowedStorageKey(key);

    const signed = await createSignedUpload(this.client!, {
      bucket: this.config!.bucket,
      key,
      mimeType: normalized.mimeType,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId,
        kind: normalized.kind === 'video' ? MediaKind.VIDEO : MediaKind.IMAGE,
        mimeType: normalized.mimeType,
        sizeBytes: normalized.sizeBytes,
        durationSec: normalized.durationSeconds,
        storageKey: key,
        status: 'UPLOADING',
      },
    });

    return {
      assetId: asset.id,
      ...signed,
      status: 'UPLOADING',
      note: 'Upload via signed URL only. Client must not invent storage URLs or filenames.',
    };
  }

  async completeUpload(ownerId: string, assetId: string) {
    this.requireStorageConfigured();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.ownerId !== ownerId) {
      throw new BadRequestException('ASSET_NOT_FOUND');
    }
    assertAllowedStorageKey(asset.storageKey);

    const head = await objectExists(this.client!, this.config!.bucket, asset.storageKey);
    if (!head.exists) {
      throw new BadRequestException('UPLOAD_NOT_FOUND_IN_STORAGE');
    }

    const sizeBytes = head.sizeBytes ?? asset.sizeBytes;
    if (asset.kind === MediaKind.VIDEO && sizeBytes > MEDIA_LIMITS.maxVideoBytes) {
      throw new BadRequestException('Video exceeds 200MB limit');
    }
    if (asset.kind === MediaKind.IMAGE && sizeBytes > MEDIA_LIMITS.maxImageBytes) {
      throw new BadRequestException('Image exceeds 20MB limit');
    }

    await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: 'UPLOADED',
        sizeBytes,
        mimeType: head.contentType ?? asset.mimeType,
      },
    });

    await this.enqueueProcessing(
      assetId,
      asset.storageKey,
      asset.kind === 'VIDEO' ? 'video' : 'image',
    );
    return decorateAsset(
      await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } }),
      this.storageBinding(),
    );
  }

  async getAsset(assetId: string, ownerId?: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new BadRequestException('ASSET_NOT_FOUND');
    if (ownerId && asset.ownerId !== ownerId) throw new BadRequestException('ASSET_NOT_FOUND');
    return decorateAsset(asset, this.storageBinding());
  }

  async attachToAd(ownerId: string, adId: string, assetId: string, sortOrder = 0) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.ownerId !== ownerId) throw new BadRequestException('AD_NOT_FOUND');
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.ownerId !== ownerId) throw new BadRequestException('ASSET_NOT_FOUND');
    if (asset.status !== 'READY') {
      throw new BadRequestException('MEDIA_NOT_READY');
    }

    const existing = await this.prisma.adMedia.findMany({
      where: { adId },
      include: { asset: true },
    });
    const imageCount = existing.filter((row) => row.asset.kind === MediaKind.IMAGE).length;
    if (asset.kind === MediaKind.IMAGE && imageCount >= MEDIA_LIMITS.maxImages) {
      throw new BadRequestException(`Max ${MEDIA_LIMITS.maxImages} images per ad`);
    }

    const row = await this.prisma.adMedia.create({
      data: {
        adId,
        assetId,
        sortOrder,
        kind: asset.kind,
      },
      include: { asset: true },
    });
    return { ...row, asset: await decorateAsset(row.asset, this.storageBinding()) };
  }

  private async enqueueProcessing(
    assetId: string,
    storageKey: string,
    kind: 'image' | 'video',
  ) {
    if (this.inlineProcessing) {
      await this.processInline(assetId, storageKey, kind);
      return;
    }

    if (!this.redis) {
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'QUEUED' },
      });
      return;
    }
    await this.redis.lpush(
      'e3lani:media:jobs',
      JSON.stringify({
        assetId,
        storageKey,
        kind,
        enqueuedAt: new Date().toISOString(),
      }),
    );
    await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'QUEUED' },
    });
  }

  private async processInline(
    assetId: string,
    storageKey: string,
    kind: 'image' | 'video',
  ) {
    try {
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'PROCESSING' },
      });
      const result = await processMediaInline(this.client!, this.config!.bucket, {
        assetId,
        storageKey,
        kind,
      });
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: {
          status: 'READY',
          posterKey: result.posterKey,
          ...(result.width !== undefined ? { width: result.width } : {}),
          ...(result.height !== undefined ? { height: result.height } : {}),
        },
      });
      this.log.log(`Inline media ${assetId} → READY (${result.mode})`);
    } catch (error) {
      this.log.error(
        `Inline media failed ${assetId}: ${error instanceof Error ? error.message : error}`,
      );
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'FAILED' },
      });
    }
  }

  requireStorageConfigured() {
    const status = resolveStorageEnv();
    if (status.configured && this.client && this.config) {
      return;
    }
    if (status.misconfigured) {
      throw new ServiceUnavailableException(
        `STORAGE_MISCONFIGURED: missing ${status.missing.join(', ')}`,
      );
    }
    throw new ServiceUnavailableException(
      `STORAGE_NOT_CONFIGURED: missing ${status.missing.join(', ') || 'R2_ENDPOINT'}`,
    );
  }
}
