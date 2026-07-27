import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { validateMediaIntent } from '@e3lani/validation';
import {
  assertAllowedStorageKey,
  buildObjectKey,
  createSignedUpload,
  createStorageClient,
  ensureBucket,
  objectExists,
} from '@e3lani/storage';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly bucket = process.env.S3_BUCKET ?? 'e3lani';
  private readonly client = createStorageClient({
    endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: this.bucket,
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'e3lani',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'e3lanisecret',
    ...(process.env.S3_PUBLIC_BASE_URL
      ? { publicBaseUrl: process.env.S3_PUBLIC_BASE_URL }
      : {}),
  });
  private redis: Redis | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.S3_ENDPOINT) {
      await ensureBucket(this.client, this.bucket);
    }
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      try {
        await this.redis.connect();
      } catch {
        this.redis = null;
      }
    }
  }

  async createUploadIntent(
    ownerId: string,
    input: {
      kind: 'image' | 'video';
      mimeType: string;
      sizeBytes: number;
      durationSeconds?: number;
      adId?: string;
    },
  ) {
    try {
      validateMediaIntent({
        kind: input.kind,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        durationSeconds: input.durationSeconds,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const key = buildObjectKey({
      ownerId,
      kind: input.kind,
      mimeType: input.mimeType,
    });
    assertAllowedStorageKey(key);

    const signed = await createSignedUpload(this.client, {
      bucket: this.bucket,
      key,
      mimeType: input.mimeType,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId,
        kind: input.kind === 'video' ? MediaKind.VIDEO : MediaKind.IMAGE,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        durationSec: input.durationSeconds,
        storageKey: key,
        status: 'UPLOADING',
      },
    });

    return {
      assetId: asset.id,
      ...signed,
      note: 'Upload via signed URL only. Client must not invent storage URLs.',
    };
  }

  async completeUpload(ownerId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.ownerId !== ownerId) {
      throw new BadRequestException('ASSET_NOT_FOUND');
    }
    assertAllowedStorageKey(asset.storageKey);

    const head = await objectExists(this.client, this.bucket, asset.storageKey);
    if (!head.exists) {
      throw new BadRequestException('UPLOAD_NOT_FOUND_IN_STORAGE');
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: 'UPLOADED',
        sizeBytes: head.sizeBytes ?? asset.sizeBytes,
        mimeType: head.contentType ?? asset.mimeType,
      },
    });

    await this.enqueueProcessing(updated.id, updated.storageKey, updated.kind === 'VIDEO' ? 'video' : 'image');
    return updated;
  }

  async attachToAd(ownerId: string, adId: string, assetId: string, sortOrder = 0) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad || ad.ownerId !== ownerId) throw new BadRequestException('AD_NOT_FOUND');
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset || asset.ownerId !== ownerId) throw new BadRequestException('ASSET_NOT_FOUND');

    return this.prisma.adMedia.create({
      data: {
        adId,
        assetId,
        sortOrder,
        kind: asset.kind,
      },
      include: { asset: true },
    });
  }

  private async enqueueProcessing(assetId: string, storageKey: string, kind: 'image' | 'video') {
    if (!this.redis) {
      // Worker may poll DB; mark queued anyway.
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

  requireStorageConfigured() {
    if (!process.env.S3_ENDPOINT) {
      throw new ServiceUnavailableException('STORAGE_NOT_CONFIGURED');
    }
  }
}
