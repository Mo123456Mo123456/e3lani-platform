export const MIB = 1024 * 1024;

export const MEDIA_HARD_LIMITS = {
  imageMaxBytes: 5 * MIB,
  videoMaxBytes: 50 * MIB,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoMimeTypes: ["video/mp4"],
} as const;

export type AllowedImageMimeType = (typeof MEDIA_HARD_LIMITS.allowedImageMimeTypes)[number];
export type AllowedVideoMimeType = (typeof MEDIA_HARD_LIMITS.allowedVideoMimeTypes)[number];
export type AllowedMediaMimeType = AllowedImageMimeType | AllowedVideoMimeType;
export type MediaKind = "image" | "video";

export type PublicMediaPolicy = {
  imageMaxBytes: number;
  videoMaxBytes: number;
  allowedImageMimeTypes: AllowedImageMimeType[];
  allowedVideoMimeTypes: AllowedVideoMimeType[];
  requirePrimaryImage: boolean;
  maxImages: number;
  maxVideos: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

function allowedValues<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const filtered = value.filter((entry): entry is T =>
    typeof entry === "string" && allowed.includes(entry as T),
  );
  return filtered.length > 0 ? [...new Set(filtered)] : [...fallback];
}

export function normalizeMediaPolicy(mediaValue: unknown, adsValue?: unknown): PublicMediaPolicy {
  const media = asRecord(mediaValue);
  const ads = asRecord(adsValue);

  return {
    imageMaxBytes: positiveInteger(
      media.imageMaxBytes,
      MEDIA_HARD_LIMITS.imageMaxBytes,
      MEDIA_HARD_LIMITS.imageMaxBytes,
    ),
    videoMaxBytes: positiveInteger(
      media.videoMaxBytes,
      MEDIA_HARD_LIMITS.videoMaxBytes,
      MEDIA_HARD_LIMITS.videoMaxBytes,
    ),
    allowedImageMimeTypes: allowedValues(
      media.allowedImageMimeTypes,
      MEDIA_HARD_LIMITS.allowedImageMimeTypes,
      MEDIA_HARD_LIMITS.allowedImageMimeTypes,
    ),
    allowedVideoMimeTypes: allowedValues(
      media.allowedVideoMimeTypes,
      MEDIA_HARD_LIMITS.allowedVideoMimeTypes,
      MEDIA_HARD_LIMITS.allowedVideoMimeTypes,
    ),
    requirePrimaryImage: media.requirePrimaryImage !== false,
    maxImages: positiveInteger(ads.maxImages, 10, 10),
    maxVideos: positiveInteger(ads.maxVideos, 1, 1),
  };
}

export function mediaKindForMimeType(
  mimeType: string,
  policy: PublicMediaPolicy,
): MediaKind | null {
  if (policy.allowedImageMimeTypes.includes(mimeType as AllowedImageMimeType)) return "image";
  if (policy.allowedVideoMimeTypes.includes(mimeType as AllowedVideoMimeType)) return "video";
  return null;
}

export function validateMediaMetadata(
  input: { mimeType: string; bytes: number },
  policy: PublicMediaPolicy,
): { kind: MediaKind; maxBytes: number } {
  const kind = mediaKindForMimeType(input.mimeType, policy);
  if (!kind) throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  if (!Number.isInteger(input.bytes) || input.bytes <= 0) throw new Error("MEDIA_SIZE_INVALID");
  const maxBytes = kind === "image" ? policy.imageMaxBytes : policy.videoMaxBytes;
  if (input.bytes > maxBytes) throw new Error("MEDIA_SIZE_EXCEEDED");
  return { kind, maxBytes };
}

