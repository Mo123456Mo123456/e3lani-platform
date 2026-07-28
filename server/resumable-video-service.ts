import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { MIB, validateMediaMetadata } from "../shared/media-policy";
import { ENV } from "./_core/env";
import * as db from "./db";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headS3Object,
  isS3MultipartConfigured,
  listMultipartParts,
  presignUploadPart,
  readS3ObjectPrefix,
  type S3UploadedPart,
} from "./s3-multipart";

export const RESUMABLE_VIDEO_PART_BYTES = 5 * MIB;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PARTS = 10_000;

type ResumableVideoMetadata = {
  fileName: string;
  mimeType: "video/mp4";
  bytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
};

type ResumableTicket = ResumableVideoMetadata & {
  version: 1;
  ownerId: number;
  storageKey: string;
  objectKey: string;
  uploadId: string;
  partBytes: number;
  totalParts: number;
  expiresAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function ticketSecret() {
  const secret = ENV.mediaTicketSecret;
  if (secret.length < 24) throw new Error("MEDIA_TICKET_SECRET_UNAVAILABLE");
  return secret;
}

function signPayload(encoded: string) {
  return createHmac("sha256", ticketSecret()).update(encoded).digest("base64url");
}

function createTicket(payload: ResumableTicket) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

function verifyTicket(ticket: string, ownerId: number) {
  const [encoded, signature, extra] = ticket.split(".");
  if (!encoded || !signature || extra) throw new Error("MEDIA_RESUME_TICKET_INVALID");
  const expected = Buffer.from(signPayload(encoded));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("MEDIA_RESUME_TICKET_INVALID");
  }

  let payload: ResumableTicket;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as ResumableTicket;
  } catch {
    throw new Error("MEDIA_RESUME_TICKET_INVALID");
  }
  if (
    payload.version !== 1 ||
    payload.ownerId !== ownerId ||
    payload.mimeType !== "video/mp4" ||
    !payload.storageKey.startsWith("s3/") ||
    !payload.objectKey ||
    !payload.uploadId ||
    payload.partBytes !== RESUMABLE_VIDEO_PART_BYTES ||
    !Number.isInteger(payload.totalParts) ||
    payload.totalParts < 1 ||
    payload.totalParts > MAX_PARTS ||
    payload.expiresAt <= Date.now()
  ) {
    throw new Error(payload.expiresAt <= Date.now() ? "MEDIA_RESUME_TICKET_EXPIRED" : "MEDIA_RESUME_TICKET_INVALID");
  }
  return payload;
}

function safeFileName(value: string) {
  const base = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);
  const withoutExtension = base.replace(/\.mp4$/i, "") || "video";
  return `${withoutExtension}.mp4`;
}

function publicStorageUrl(storageKey: string) {
  return `/manus-storage/${storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function expectedPartSize(payload: ResumableTicket, partNumber: number) {
  if (partNumber < payload.totalParts) return payload.partBytes;
  return payload.bytes - payload.partBytes * (payload.totalParts - 1);
}

function validateParts(payload: ResumableTicket, parts: S3UploadedPart[]) {
  if (parts.length !== payload.totalParts) throw new Error("MEDIA_RESUME_PARTS_INCOMPLETE");
  for (let partNumber = 1; partNumber <= payload.totalParts; partNumber += 1) {
    const part = parts[partNumber - 1];
    if (!part || part.partNumber !== partNumber) throw new Error("MEDIA_RESUME_PARTS_INCOMPLETE");
    if (part.size !== expectedPartSize(payload, partNumber)) {
      throw new Error("MEDIA_RESUME_PART_SIZE_MISMATCH");
    }
  }
}

function validateMp4Prefix(prefix: Buffer) {
  if (prefix.length < 12) throw new Error("MEDIA_CONTENT_MISMATCH");
  const marker = prefix.subarray(4, Math.min(prefix.length, 20)).toString("ascii");
  if (!marker.includes("ftyp")) throw new Error("MEDIA_CONTENT_MISMATCH");
}

async function finalizeAsset(payload: ResumableTicket) {
  const existing = await db.getOwnedMediaAssetByStorageKey(payload.ownerId, payload.storageKey);
  if (existing) return existing;

  const [head, prefix] = await Promise.all([
    headS3Object(payload.objectKey),
    readS3ObjectPrefix(payload.objectKey, 32),
  ]);
  if (head.bytes !== payload.bytes) throw new Error("MEDIA_SIZE_MISMATCH");
  validateMp4Prefix(prefix);

  return db.createMediaAsset({
    ownerId: payload.ownerId,
    storageKey: payload.storageKey,
    originalUrl: publicStorageUrl(payload.storageKey),
    mediaType: "video",
    mimeType: payload.mimeType,
    bytes: payload.bytes,
    width: payload.width ?? null,
    height: payload.height ?? null,
    durationMs: payload.durationMs ?? null,
    processingStatus: "ready",
    variants: null,
    failureReason: null,
  });
}

export function getResumableVideoCapabilities() {
  return {
    enabled: isS3MultipartConfigured(),
    partBytes: RESUMABLE_VIDEO_PART_BYTES,
    maxSessionHours: SESSION_TTL_MS / (60 * 60 * 1000),
  };
}

export async function prepareResumableVideoUpload(
  ownerId: number,
  input: ResumableVideoMetadata,
) {
  if (!isS3MultipartConfigured()) throw new Error("S3_MULTIPART_NOT_CONFIGURED");
  const policy = await db.getPublicMediaPolicy();
  const metadata = validateMediaMetadata(input, policy);
  if (metadata.kind !== "video" || input.mimeType !== "video/mp4") {
    throw new Error("MEDIA_RESUME_VIDEO_ONLY");
  }

  const totalParts = Math.ceil(input.bytes / RESUMABLE_VIDEO_PART_BYTES);
  if (totalParts < 1 || totalParts > MAX_PARTS) throw new Error("MEDIA_RESUME_PART_COUNT_INVALID");
  const objectKey = `media/resumable/${ownerId}/${randomUUID()}/${safeFileName(input.fileName)}`;
  const uploadId = await createMultipartUpload({ key: objectKey, contentType: input.mimeType });
  const payload: ResumableTicket = {
    version: 1,
    ownerId,
    storageKey: `s3/${objectKey}`,
    objectKey,
    uploadId,
    fileName: safeFileName(input.fileName),
    mimeType: input.mimeType,
    bytes: input.bytes,
    width: input.width ?? null,
    height: input.height ?? null,
    durationMs: input.durationMs ?? null,
    partBytes: RESUMABLE_VIDEO_PART_BYTES,
    totalParts,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  return {
    ticket: createTicket(payload),
    partBytes: payload.partBytes,
    totalParts: payload.totalParts,
    expiresAt: new Date(payload.expiresAt).toISOString(),
    uploadedParts: [] as S3UploadedPart[],
  };
}

export async function getResumableVideoStatus(ownerId: number, ticket: string) {
  const payload = verifyTicket(ticket, ownerId);
  const existing = await db.getOwnedMediaAssetByStorageKey(ownerId, payload.storageKey);
  if (existing) {
    return {
      completed: true as const,
      asset: existing,
      partBytes: payload.partBytes,
      totalParts: payload.totalParts,
      uploadedParts: [] as S3UploadedPart[],
      expiresAt: new Date(payload.expiresAt).toISOString(),
    };
  }
  const uploadedParts = await listMultipartParts(payload.objectKey, payload.uploadId);
  return {
    completed: false as const,
    asset: null,
    partBytes: payload.partBytes,
    totalParts: payload.totalParts,
    uploadedParts,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

export async function signResumableVideoPart(
  ownerId: number,
  ticket: string,
  partNumber: number,
) {
  const payload = verifyTicket(ticket, ownerId);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > payload.totalParts) {
    throw new Error("MEDIA_RESUME_PART_NUMBER_INVALID");
  }
  return {
    partNumber,
    bytes: expectedPartSize(payload, partNumber),
    uploadUrl: presignUploadPart({
      key: payload.objectKey,
      uploadId: payload.uploadId,
      partNumber,
      expiresSeconds: 15 * 60,
    }),
    headers: {} as Record<string, string>,
  };
}

export async function completeResumableVideoUpload(ownerId: number, ticket: string) {
  const payload = verifyTicket(ticket, ownerId);
  const existing = await db.getOwnedMediaAssetByStorageKey(ownerId, payload.storageKey);
  if (existing) return existing;

  let parts: S3UploadedPart[];
  try {
    parts = await listMultipartParts(payload.objectKey, payload.uploadId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NoSuchUpload")) return finalizeAsset(payload);
    throw error;
  }
  validateParts(payload, parts);
  await completeMultipartUpload(payload.objectKey, payload.uploadId, parts);
  return finalizeAsset(payload);
}

export async function abortResumableVideoUpload(ownerId: number, ticket: string) {
  const payload = verifyTicket(ticket, ownerId);
  const existing = await db.getOwnedMediaAssetByStorageKey(ownerId, payload.storageKey);
  if (existing) return { success: true, completed: true } as const;
  await abortMultipartUpload(payload.objectKey, payload.uploadId);
  return { success: true, completed: false } as const;
}
