import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  headers: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly uploadTtl: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicUrl = this.config.getOrThrow<string>('S3_PUBLIC_URL').replace(/\/$/, '');
    this.uploadTtl = this.config.get<number>('S3_UPLOAD_URL_TTL') ?? 900;
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
      forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  buildKey(ownerId: string, purpose: string, extension: string): string {
    const now = new Date();
    const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return `${purpose.toLowerCase()}/${folder}/${ownerId}/${randomUUID()}.${extension}`;
  }

  async createUploadUrl(key: string, contentType: string): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: this.uploadTtl });
    return {
      uploadUrl,
      key,
      expiresIn: this.uploadTtl,
      headers: { 'Content-Type': contentType },
    };
  }

  async head(key: string): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? null };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`تعذّر حذف الملف ${key}: ${(error as Error).message}`);
    }
  }

  async createDownloadUrl(key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  publicUrlFor(key: string | null | undefined): string | null {
    if (!key) return null;
    return `${this.publicUrl}/${key.replace(/^\//, '')}`;
  }
}
