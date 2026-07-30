import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import sharp from "sharp";

import type { PublicMediaPolicy } from "../shared/media-policy";
import { validateMediaMetadata } from "../shared/media-policy";
import { ENV } from "./_core/env";
import * as db from "./db";
import {
  storageCreatePresignedPut,
  storageGetSignedUrl,
  storagePut,
} from "./storage";

const TICKET_TTL_MS = 15 * 60 * 1000;
const IMAGE_PIXEL_LIMIT = 40_000_000;

type UploadTicketPayload = {
  version: 1;
  userId: number;
  key: string;
  mimeType: string;
  bytes: number;
  fileName: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  expiresAt: number;
};

type MediaVariant = {
  key: string;
  url: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
};

export type PreparedMediaUpload = {
  ticket: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: number;
  maxBytes: number;
};

function signingSecret(): string {
  const secret = ENV.cookieSecret || ENV.forgeApiKey;
  if (!secret) throw new Error("MEDIA_UPLOAD_SIGNING_UNAVAILABLE");
  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(value: string): string {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function signTicket(payload: UploadTicketPayload): string {
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

function readTicket(ticket: string, userId: number): UploadTicketPayload {
  const [encoded, providedSignature, extra] = ticket.split(".");
  if (!encoded || !providedSignature || extra) throw new Error("MEDIA_TICKET_INVALID");
  const expected = signature(encoded);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("MEDIA_TICKET_INVALID");
  }

  const payload = JSON.parse(decodeBase64Url(encoded)) as UploadTicketPayload;
  if (payload.version !== 1 || payload.userId !== userId || payload.expiresAt <= Date.now()) {
    throw new Error(payload.expiresAt <= Date.now() ? "MEDIA_TICKET_EXPIRED" : "MEDIA_TICKET_INVALID");
  }
  return payload;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/mp4") return "mp4";
  throw new Error("MEDIA_TYPE_NOT_ALLOWED");
}

function detectedMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }
  return null;
}

async function fetchUploadedObject(payload: UploadTicketPayload): Promise<Buffer> {
  const signedUrl = await storageGetSignedUrl(payload.key);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("MEDIA_UPLOAD_NOT_FOUND");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > payload.bytes) throw new Error("MEDIA_SIZE_MISMATCH");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== payload.bytes) throw new Error("MEDIA_SIZE_MISMATCH");
  if (detectedMimeType(buffer) !== payload.mimeType) throw new Error("MEDIA_CONTENT_MISMATCH");
  return buffer;
}

async function createImageVariants(userId: number, sourceKey: string, source: Buffer): Promise<{
  width: number;
  height: number;
  variants: Record<string, MediaVariant>;
}> {
  const image = sharp(source, { failOn: "warning", limitInputPixels: IMAGE_PIXEL_LIMIT }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("MEDIA_IMAGE_INVALID");

  const assetId = createHash("sha256").update(sourceKey).digest("hex").slice(0, 32);
  const definitions = [
    { name: "thumbnail", size: 320, quality: 78 },
    { name: "medium", size: 960, quality: 82 },
    { name: "full", size: 1600, quality: 86 },
  ] as const;

  const entries: Array<readonly [string, MediaVariant]> = [];
  for (const { name, size, quality } of definitions) {
    const output = await sharp(source, { failOn: "warning", limitInputPixels: IMAGE_PIXEL_LIMIT })
      .rotate()
      .resize(size, size, { fit: "cover", position: "centre", withoutEnlargement: false })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const stored = await storagePut(
      `media/users/${userId}/${assetId}/${name}.webp`,
      output.data,
      "image/webp",
    );
    entries.push([
      name,
      {
        ...stored,
        mimeType: "image/webp",
        bytes: output.data.length,
        width: output.info.width,
        height: output.info.height,
      },
    ]);
  }

  return {
    width: metadata.width,
    height: metadata.height,
    variants: Object.fromEntries(entries),
  };
}

export async function prepareMediaUpload(
  userId: number,
  input: {
    fileName: string;
    mimeType: string;
    bytes: number;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
  },
): Promise<PreparedMediaUpload> {
  const policy = await db.getPublicMediaPolicy();
  const { maxBytes } = validateMediaMetadata(input, policy);
  const extension = extensionForMime(input.mimeType);
  const now = new Date();
  const key = [
    "media",
    "incoming",
    `user-${userId}`,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
  const expiresAt = Date.now() + TICKET_TTL_MS;
  const payload: UploadTicketPayload = {
    version: 1,
    userId,
    key,
    mimeType: input.mimeType,
    bytes: input.bytes,
    fileName: input.fileName.slice(0, 180),
    width: input.width ?? null,
    height: input.height ?? null,
    durationMs: input.durationMs ?? null,
    expiresAt,
  };
  const prepared = await storageCreatePresignedPut(key, input.mimeType);
  return {
    ticket: signTicket(payload),
    uploadUrl: prepared.uploadUrl,
    headers: prepared.headers,
    expiresAt,
    maxBytes,
  };
}

export async function completeMediaUpload(userId: number, ticket: string) {
  const payload = readTicket(ticket, userId);
  const existing = await db.getOwnedMediaAssetByStorageKey(userId, payload.key);
  if (existing) return existing;

  const policy: PublicMediaPolicy = await db.getPublicMediaPolicy();
  const { kind } = validateMediaMetadata(payload, policy);
  const source = await fetchUploadedObject(payload);

  if (kind === "image") {
    const processed = await createImageVariants(userId, payload.key, source);
    return db.createMediaAsset({
      ownerId: userId,
      storageKey: payload.key,
      originalUrl: `/manus-storage/${payload.key}`,
      mediaType: "image",
      mimeType: payload.mimeType,
      bytes: source.length,
      width: processed.width,
      height: processed.height,
      durationMs: null,
      processingStatus: "ready",
      variants: {
        original: {
          key: payload.key,
          url: `/manus-storage/${payload.key}`,
          mimeType: payload.mimeType,
          bytes: source.length,
          width: processed.width,
          height: processed.height,
        },
        ...processed.variants,
      },
    });
  }

  return db.createMediaAsset({
    ownerId: userId,
    storageKey: payload.key,
    originalUrl: `/manus-storage/${payload.key}`,
    mediaType: "video",
    mimeType: payload.mimeType,
    bytes: source.length,
    width: payload.width,
    height: payload.height,
    durationMs: payload.durationMs,
    processingStatus: "ready",
    variants: {
      original: {
        key: payload.key,
        url: `/manus-storage/${payload.key}`,
        mimeType: payload.mimeType,
        bytes: source.length,
        width: payload.width,
        height: payload.height,
      },
    },
  });
}
