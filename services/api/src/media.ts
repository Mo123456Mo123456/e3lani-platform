import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  Param,
  Post
} from "@nestjs/common";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import { parseServerEnv } from "@e3lani/config";
import { prisma } from "@e3lani/database";
import { prepareUploadSchema } from "@e3lani/types";
import { CurrentUser, type AuthUser, parse } from "./common";

const env = parseServerEnv();

@Injectable()
export class MediaService implements OnModuleDestroy {
  private readonly s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
  });
  private readonly redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  private readonly queue = new Queue("media-processing", { connection: this.redis });

  async prepare(userId: string, body: unknown) {
    const input = parse(prepareUploadSchema, body);
    const kind = input.contentType.startsWith("image/") ? "IMAGE" : "VIDEO";
    const maxBytes = kind === "IMAGE" ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (input.size > maxBytes) throw new BadRequestException("MEDIA_SIZE_EXCEEDED");
    const extension = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const key = `original/${userId}/${randomUUID()}.${extension}`;
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        kind,
        originalKey: key,
        mimeType: input.contentType,
        sizeBytes: input.size,
        status: "UPLOADING"
      }
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
        Metadata: { assetId: asset.id, ownerId: userId }
      }),
      { expiresIn: 900 }
    );
    return {
      assetId: asset.id,
      uploadUrl,
      headers: { "content-type": input.contentType },
      expiresInSeconds: 900
    };
  }

  async complete(userId: string, assetId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId, status: "UPLOADING" }
    });
    if (!asset) throw new NotFoundException("MEDIA_NOT_FOUND");
    const object = await this.s3.send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: asset.originalKey })
    );
    if (object.ContentLength !== asset.sizeBytes || object.ContentType !== asset.mimeType) {
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: "REJECTED", rejectionCode: "OBJECT_METADATA_MISMATCH" }
      });
      throw new BadRequestException("MEDIA_METADATA_MISMATCH");
    }
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "QUEUED" } });
    await this.queue.add(
      "process",
      { assetId: asset.id },
      { jobId: asset.id, attempts: 3, backoff: { type: "exponential", delay: 3000 } }
    );
    return { assetId: asset.id, status: "QUEUED" };
  }

  async status(userId: string, assetId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId },
      select: { id: true, status: true, rejectionCode: true, updatedAt: true }
    });
    if (!asset) throw new NotFoundException("MEDIA_NOT_FOUND");
    return asset;
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit();
  }
}

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("prepare")
  prepare(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.media.prepare(user.id, body);
  }

  @Post(":id/complete")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.media.complete(user.id, id);
  }

  @Get(":id")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.media.status(user.id, id);
  }
}
