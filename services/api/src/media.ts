import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";

import { prisma } from "@e3lani/database";
import { mediaHardLimits, uploadRequestSchema } from "@e3lani/types";

import { CurrentUser, JwtAuthGuard, type AuthUser } from "./auth.js";

function redisConnection() {
  const redis = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: redis.hostname,
    port: Number(redis.port || 6379),
    username: redis.username || undefined,
    password: redis.password || undefined,
  };
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

const mediaQueue = new Queue("media-processing", { connection: redisConnection() });

function publicMediaUrl(asset: {
  thumbnailUrl: string | null;
  variants: unknown;
  originalKey: string;
}) {
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if (asset.variants && typeof asset.variants === "object") {
    const variants = asset.variants as Record<string, unknown>;
    const candidate = variants.medium ?? variants.original;
    if (typeof candidate === "string") return candidate;
  }
  const endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
  return `${endpoint}/${process.env.S3_BUCKET}/${asset.originalKey}`;
}

@Controller("media")
@UseGuards(JwtAuthGuard)
export class MediaController {
  @Get(":id")
  async status(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, ownerId: user.id },
      select: {
        id: true,
        kind: true,
        status: true,
        thumbnailUrl: true,
        variants: true,
        failureReason: true,
      },
    });
    if (!asset) throw new NotFoundException("MEDIA_NOT_FOUND");
    return asset;
  }

  @Post("uploads")
  async prepare(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = uploadRequestSchema.parse(body);
    const isVideo = input.mimeType.startsWith("video/");
    const maxBytes = isVideo ? mediaHardLimits.maxVideoBytes : mediaHardLimits.maxImageBytes;
    if (input.bytes > maxBytes) throw new BadRequestException("MEDIA_TOO_LARGE");

    const id = randomUUID();
    const extension = input.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const key = `users/${user.id}/${id}/original.${extension}`;
    await prisma.mediaAsset.create({
      data: {
        id,
        ownerId: user.id,
        kind: isVideo ? "VIDEO" : "IMAGE",
        originalKey: key,
        mimeType: input.mimeType,
        bytes: input.bytes,
      },
    });
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        ContentType: input.mimeType,
        ContentLength: input.bytes,
      }),
      { expiresIn: 10 * 60 },
    );
    return {
      mediaId: id,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": input.mimeType },
      expiresInSeconds: 600,
    };
  }

  @Post(":id/finalize")
  async finalize(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await prisma.mediaAsset.findFirst({ where: { id, ownerId: user.id } });
    if (!asset) throw new NotFoundException("MEDIA_NOT_FOUND");
    if (asset.status !== "PENDING_UPLOAD" && asset.status !== "FAILED") {
      throw new BadRequestException("MEDIA_CANNOT_BE_FINALIZED");
    }
    let object;
    try {
      object = await s3.send(
        new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.originalKey }),
      );
    } catch {
      throw new BadRequestException("UPLOADED_OBJECT_NOT_FOUND");
    }
    if (Number(object.ContentLength) !== asset.bytes || object.ContentType !== asset.mimeType) {
      throw new BadRequestException("UPLOADED_OBJECT_MISMATCH");
    }
    await prisma.mediaAsset.update({
      where: { id },
      data: { status: "QUEUED", failureReason: null },
    });
    await mediaQueue.add(
      "process",
      { mediaId: id },
      { jobId: id, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    return { mediaId: id, status: "QUEUED" };
  }

  @Patch(":id/profile-avatar")
  async avatar(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, ownerId: user.id, kind: "IMAGE", status: "READY" },
    });
    if (!asset) throw new BadRequestException("PROFILE_IMAGE_NOT_READY");
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: publicMediaUrl(asset) },
    });
    return { avatarUrl: publicMediaUrl(asset) };
  }

  @Delete("profile-avatar")
  async removeAvatar(@CurrentUser() user: AuthUser) {
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
    return { avatarUrl: null };
  }

  @Patch(":id/business/:slot")
  async businessImage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("slot") slot: string,
  ) {
    if (!["logo", "cover"].includes(slot)) throw new BadRequestException("IMAGE_SLOT_INVALID");
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, ownerId: user.id, kind: "IMAGE", status: "READY" },
    });
    if (!asset) throw new BadRequestException("BUSINESS_IMAGE_NOT_READY");
    const profile = await prisma.businessProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw new BadRequestException("BUSINESS_PROFILE_REQUIRED");
    const url = publicMediaUrl(asset);
    await prisma.businessProfile.update({
      where: { userId: user.id },
      data: slot === "logo" ? { logoUrl: url } : { coverUrl: url },
    });
    return { slot, url };
  }

  @Delete(":id")
  async remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, ownerId: user.id },
      include: { _count: { select: { adMedia: true, postMedia: true, bannerLogos: true } } },
    });
    if (!asset) throw new NotFoundException("MEDIA_NOT_FOUND");
    if (asset._count.adMedia || asset._count.postMedia || asset._count.bannerLogos) {
      throw new BadRequestException("MEDIA_IN_USE");
    }
    await prisma.mediaAsset.delete({ where: { id } });
    return { deleted: true };
  }
}
