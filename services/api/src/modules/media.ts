import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { mediaUploadSchema } from "@e3lani/types";

import { CurrentUser, type AuthUser, parseInput, PrismaService } from "../common";

const completeSchema = z.object({ mediaId: z.string().cuid() });
const profileMediaSchema = z.object({
  mediaId: z.string().cuid(),
  slot: z.enum(["AVATAR", "LOGO", "COVER"]),
});

@Injectable()
export class MediaService {
  private readonly s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
  private readonly redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  private readonly queue = new Queue(process.env.MEDIA_QUEUE_NAME ?? "media-processing", {
    connection: this.redis,
  });
  private readonly bucket = process.env.S3_BUCKET!;

  constructor(private readonly prisma: PrismaService) {}

  async prepare(user: AuthUser, rawInput: unknown) {
    const input = parseInput(mediaUploadSchema, rawInput);
    const expectedKind = input.mimeType.startsWith("image/") ? "IMAGE" : "VIDEO";
    if (expectedKind !== input.kind) throw new BadRequestException("MEDIA_KIND_MISMATCH");
    if (input.purpose !== "POST" && input.kind !== "IMAGE") {
      throw new BadRequestException("PROFILE_MEDIA_MUST_BE_IMAGE");
    }
    if (input.purpose !== "POST" && input.sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException("PROFILE_IMAGE_TOO_LARGE");
    }
    const extension = input.mimeType === "image/jpeg"
      ? "jpg"
      : input.mimeType === "video/quicktime"
        ? "mov"
        : input.mimeType.split("/")[1];
    const sourceKey = `uploads/${user.id}/${input.purpose.toLowerCase()}/${randomUUID()}.${extension}`;
    const media = await this.prisma.mediaAsset.create({
      data: {
        ownerId: user.id,
        kind: input.kind,
        purpose: input.purpose,
        sourceKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: sourceKey,
        ContentType: input.mimeType,
        ContentLength: input.sizeBytes,
        Metadata: { "media-id": media.id, "owner-id": user.id },
      }),
      { expiresIn: 900 },
    );
    return {
      mediaId: media.id,
      uploadUrl,
      method: "PUT",
      headers: { "content-type": input.mimeType },
      expiresInSeconds: 900,
    };
  }

  async complete(user: AuthUser, rawInput: unknown) {
    const { mediaId } = parseInput(completeSchema, rawInput);
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ownerId: user.id, status: "PENDING_UPLOAD" },
    });
    if (!media) throw new NotFoundException("MEDIA_UPLOAD_NOT_FOUND");
    const object = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: media.sourceKey }),
    );
    if (Number(object.ContentLength) !== media.sizeBytes || object.ContentType !== media.mimeType) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: media.sourceKey }));
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: "FAILED", processingError: "UPLOADED_OBJECT_MISMATCH" },
      });
      throw new BadRequestException("UPLOADED_OBJECT_MISMATCH");
    }
    await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: { status: "QUEUED" },
    });
    await this.queue.add(
      media.kind === "IMAGE" ? "process-image" : "process-video",
      { mediaId: media.id },
      {
        jobId: media.id,
        attempts: 3,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    );
    return { mediaId: media.id, status: "QUEUED" };
  }

  status(user: AuthUser, mediaId: string) {
    return this.prisma.mediaAsset.findFirstOrThrow({
      where: { id: mediaId, ownerId: user.id, status: { not: "DELETED" } },
      select: {
        id: true,
        kind: true,
        purpose: true,
        status: true,
        width: true,
        height: true,
        durationSeconds: true,
        processingError: true,
      },
    });
  }

  async assignProfileMedia(user: AuthUser, rawInput: unknown) {
    const input = parseInput(profileMediaSchema, rawInput);
    const media = await this.prisma.mediaAsset.findFirst({
      where: {
        id: input.mediaId,
        ownerId: user.id,
        status: "READY",
        kind: "IMAGE",
        purpose: input.slot,
      },
    });
    if (!media) throw new BadRequestException("PROFILE_MEDIA_NOT_READY_OR_OWNED");
    if (input.slot === "LOGO") {
      await this.prisma.businessProfile.upsert({
        where: { userId: user.id },
        update: { logoMediaId: media.id },
        create: { userId: user.id, legalName: "", logoMediaId: media.id },
      });
    } else {
      await this.prisma.userProfile.update({
        where: { userId: user.id },
        data: input.slot === "AVATAR" ? { avatarMediaId: media.id } : { coverMediaId: media.id },
      });
    }
    return { success: true };
  }

  async removeProfileMedia(user: AuthUser, slot: "AVATAR" | "LOGO" | "COVER") {
    if (slot === "LOGO") {
      await this.prisma.businessProfile.updateMany({
        where: { userId: user.id },
        data: { logoMediaId: null },
      });
    } else {
      await this.prisma.userProfile.update({
        where: { userId: user.id },
        data: slot === "AVATAR" ? { avatarMediaId: null } : { coverMediaId: null },
      });
    }
    return { success: true };
  }
}

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("prepare")
  prepare(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.media.prepare(user, body);
  }

  @Post("complete")
  complete(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.media.complete(user, body);
  }

  @Post("profile")
  assignProfileMedia(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.media.assignProfileMedia(user, body);
  }

  @Delete("profile/:slot")
  removeProfileMedia(
    @CurrentUser() user: AuthUser,
    @Param("slot") slot: "AVATAR" | "LOGO" | "COVER",
  ) {
    return this.media.removeProfileMedia(user, slot);
  }

  @Patch(":id/complete")
  completeAlias(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.media.complete(user, { mediaId: id });
  }

  @Post(":id/status")
  status(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.media.status(user, id);
  }
}
