import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";

import { adMedia, mediaAssets, profilePostMedia } from "../drizzle/schema";
import type { PublicMediaPolicy } from "../shared/media-policy";
import { validateMediaMetadata } from "../shared/media-policy";
import type { ContentIdentity } from "./content-identity";
import { ENV } from "./_core/env";
import * as db from "./db";
import {
  storageCreatePresignedPut,
  storageGetSignedUrl,
  storagePut,
} from "./storage";
import { createVideoPoster } from "./video-processing";

type MediaOwner = ContentIdentity | number;

function normalizeMediaOwner(owner: MediaOwner): ContentIdentity {
  return typeof owner === "number"
    ? { kind: "user", userId: owner, visitorSessionId: null, accountType: "advertiser" }
    : owner;
}

const TICKET_TTL_MS = 15 * 60 * 1000;
const IMAGE_PIXEL_LIMIT = 40_000_000;

type UploadTicketPayload = {
  version: 2;
  ownerKind: "user" | "visitor";
  ownerRef: number;
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

function readTicket(ticket: string, identity: ContentIdentity): UploadTicketPayload {
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
  const expectedKind = identity.kind;
  const expectedRef = identity.kind === "user" ? identity.userId : identity.visitorSessionId;
  if (
    payload.version !== 2 ||
    payload.ownerKind !== expectedKind ||
    payload.ownerRef !== expectedRef ||
    payload.expiresAt <= Date.now()
  ) {
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

async function createImageVariants(ownerKey: string, sourceKey: string, source: Buffer): Promise<{
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
      `media/${ownerKey}/${assetId}/${name}.webp`,
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
  owner: MediaOwner,
  input: {
    fileName: string;
    mimeType: string;
    bytes: number;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
  },
): Promise<PreparedMediaUpload> {
  const identity = normalizeMediaOwner(owner);
  const policy = await db.getPublicMediaPolicy();
  const { maxBytes } = validateMediaMetadata(input, policy);
  const extension = extensionForMime(input.mimeType);
  const now = new Date();
  const ownerRef = identity.kind === "user" ? identity.userId : identity.visitorSessionId;
  const ownerKey = identity.kind === "user" ? `user-${ownerRef}` : `visitor-${ownerRef}`;
  const key = [
    "media",
    "incoming",
    ownerKey,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
  const expiresAt = Date.now() + TICKET_TTL_MS;
  const payload: UploadTicketPayload = {
    version: 2,
    ownerKind: identity.kind,
    ownerRef,
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

function mediaOwnerCondition(identity: ContentIdentity) {
  return identity.kind === "user"
    ? and(eq(mediaAssets.ownerId, identity.userId), isNull(mediaAssets.ownerVisitorSessionId))
    : and(
        eq(mediaAssets.ownerVisitorSessionId, identity.visitorSessionId),
        isNull(mediaAssets.ownerId),
      );
}

function mediaOwnerValues(identity: ContentIdentity) {
  return identity.kind === "user"
    ? { ownerId: identity.userId, ownerVisitorSessionId: null }
    : { ownerId: null, ownerVisitorSessionId: identity.visitorSessionId };
}

async function getOwnedMediaAssetByStorageKey(identity: ContentIdentity, storageKey: string) {
  const database = db.requireDatabase(await db.getDb());
  const rows = await database
    .select()
    .from(mediaAssets)
    .where(and(mediaOwnerCondition(identity), eq(mediaAssets.storageKey, storageKey)))
    .limit(1);
  return rows[0] ?? null;
}

async function createOwnedMediaAsset(
  identity: ContentIdentity,
  input: Omit<typeof mediaAssets.$inferInsert, "ownerId" | "ownerVisitorSessionId">,
) {
  const database = db.requireDatabase(await db.getDb());
  try {
    await database.insert(mediaAssets).values({ ...mediaOwnerValues(identity), ...input });
  } catch (error) {
    const existing = await getOwnedMediaAssetByStorageKey(identity, input.storageKey);
    if (existing) return existing;
    throw error;
  }
  const created = await getOwnedMediaAssetByStorageKey(identity, input.storageKey);
  if (!created) throw new Error("MEDIA_DATABASE_WRITE_FAILED");
  return created;
}

export async function completeMediaUpload(owner: MediaOwner, ticket: string) {
  const identity = normalizeMediaOwner(owner);
  const payload = readTicket(ticket, identity);
  const existing = await getOwnedMediaAssetByStorageKey(identity, payload.key);
  if (existing) return existing;

  const policy: PublicMediaPolicy = await db.getPublicMediaPolicy();
  const { kind } = validateMediaMetadata(payload, policy);
  const source = await fetchUploadedObject(payload);

  if (kind === "image") {
    const ownerRef = identity.kind === "user" ? identity.userId : identity.visitorSessionId;
    const processed = await createImageVariants(
      `${identity.kind}-${ownerRef}`,
      payload.key,
      source,
    );
    return createOwnedMediaAsset(identity, {
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

  const ownerRef = identity.kind === "user" ? identity.userId : identity.visitorSessionId;
  const ownerKey = `${identity.kind}-${ownerRef}`;
  const assetId = createHash("sha256").update(payload.key).digest("hex").slice(0, 32);
  const poster = await createVideoPoster(source).catch(() => {
    throw new Error("MEDIA_VIDEO_INVALID");
  });
  const storedPoster = await storagePut(
    `media/${ownerKey}/${assetId}/poster.jpg`,
    poster,
    "image/jpeg",
  );
  return createOwnedMediaAsset(identity, {
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
      poster: {
        ...storedPoster,
        mimeType: "image/jpeg",
        bytes: poster.length,
        width: 1200,
        height: 1200,
      },
    },
  });
}

export async function listOwnedMediaAssets(owner: MediaOwner, limit = 50) {
  const identity = normalizeMediaOwner(owner);
  const database = db.requireDatabase(await db.getDb());
  return database
    .select()
    .from(mediaAssets)
    .where(mediaOwnerCondition(identity))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function deleteOwnedMediaAsset(owner: MediaOwner, mediaAssetId: number) {
  const identity = normalizeMediaOwner(owner);
  const database = db.requireDatabase(await db.getDb());
  const asset = await database
    .select()
    .from(mediaAssets)
    .where(and(mediaOwnerCondition(identity), eq(mediaAssets.id, mediaAssetId)))
    .limit(1);
  if (!asset[0]) throw new Error("MEDIA_ASSET_NOT_FOUND");
  const [adLinks, postLinks] = await Promise.all([
    database.select({ id: adMedia.id }).from(adMedia).where(eq(adMedia.mediaAssetId, mediaAssetId)).limit(1),
    database
      .select({ id: profilePostMedia.id })
      .from(profilePostMedia)
      .where(eq(profilePostMedia.mediaAssetId, mediaAssetId))
      .limit(1),
  ]);
  if (adLinks[0] || postLinks[0]) throw new Error("MEDIA_ASSET_IN_USE");
  await database
    .delete(mediaAssets)
    .where(and(mediaOwnerCondition(identity), eq(mediaAssets.id, mediaAssetId)));
  return { success: true as const };
}
