import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

import {
  type AllowedMediaMimeType,
  type MediaKind,
  type PublicMediaPolicy,
  validateMediaMetadata,
} from "@/shared/media-policy";
import { getApiBaseUrl } from "@/constants/oauth";

export type PreparedLocalMedia = {
  uri: string;
  fileName: string;
  mimeType: AllowedMediaMimeType;
  bytes: number;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type UploadController = {
  promise: Promise<void>;
  cancel: () => Promise<void>;
};

function mimeFromAsset(asset: ImagePickerAsset): AllowedMediaMimeType | null {
  const declared = asset.mimeType?.toLowerCase();
  if (
    declared === "image/jpeg" ||
    declared === "image/png" ||
    declared === "image/webp" ||
    declared === "video/mp4"
  ) {
    return declared;
  }
  const lowerName = (asset.fileName || asset.uri).toLowerCase().split("?")[0];
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".mp4")) return "video/mp4";
  return null;
}

async function fileSize(uri: string, browserFile?: File | null): Promise<number> {
  if (browserFile?.size) return browserFile.size;
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("MEDIA_FILE_UNREADABLE");
    return (await response.blob()).size;
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || typeof info.size !== "number") {
    throw new Error("MEDIA_FILE_UNREADABLE");
  }
  return info.size;
}

function safeBaseName(asset: ImagePickerAsset, fallback: string): string {
  const candidate = asset.fileName || fallback;
  const base = candidate.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return base.slice(0, 120) || fallback;
}

export async function preparePickedMedia(
  asset: ImagePickerAsset,
  policy: PublicMediaPolicy,
): Promise<PreparedLocalMedia> {
  const mimeType = mimeFromAsset(asset);
  if (!mimeType) throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  const originalBytes = asset.fileSize ?? (await fileSize(asset.uri, asset.file));
  const { kind } = validateMediaMetadata({ mimeType, bytes: originalBytes }, policy);

  if (kind === "video") {
    return {
      uri: asset.uri,
      fileName: asset.fileName || `video-${Date.now()}.mp4`,
      mimeType,
      bytes: originalBytes,
      kind,
      width: asset.width || null,
      height: asset.height || null,
      durationMs: asset.duration ?? null,
    };
  }

  if (!asset.width || !asset.height) throw new Error("MEDIA_IMAGE_DIMENSIONS_MISSING");
  const square = Math.min(asset.width, asset.height);
  const outputSize = Math.min(square, 1600);
  const originX = Math.max(0, Math.floor((asset.width - square) / 2));
  const originY = Math.max(0, Math.floor((asset.height - square) / 2));
  const actions: ImageManipulator.Action[] = [
    { crop: { originX, originY, width: square, height: square } },
  ];
  if (outputSize !== square) actions.push({ resize: { width: outputSize, height: outputSize } });

  const processed = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.86,
    format: ImageManipulator.SaveFormat.WEBP,
  });
  const bytes = await fileSize(processed.uri);
  validateMediaMetadata({ mimeType: "image/webp", bytes }, policy);
  return {
    uri: processed.uri,
    fileName: `${safeBaseName(asset, `image-${Date.now()}`)}.webp`,
    mimeType: "image/webp",
    bytes,
    kind: "image",
    width: processed.width,
    height: processed.height,
    durationMs: null,
  };
}

export function startSignedUpload(input: {
  uploadUrl: string;
  headers: Record<string, string>;
  media: PreparedLocalMedia;
  onProgress: (fraction: number) => void;
}): UploadController {
  if (Platform.OS !== "web") {
    const task = FileSystem.createUploadTask(
      input.uploadUrl,
      input.media.uri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: input.headers,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) {
          input.onProgress(Math.min(1, totalBytesSent / totalBytesExpectedToSend));
        }
      },
    );
    return {
      cancel: () => task.cancelAsync(),
      promise: task.uploadAsync().then((result) => {
        if (!result) throw new Error("MEDIA_UPLOAD_CANCELLED");
        if (result.status < 200 || result.status >= 300) throw new Error("MEDIA_UPLOAD_FAILED");
        input.onProgress(1);
      }),
    };
  }

  const xhr = new XMLHttpRequest();
  const sourceController = new AbortController();
  let cancelled = false;
  const promise = fetch(input.media.uri, { signal: sourceController.signal })
    .then((response) => {
      if (!response.ok) throw new Error("MEDIA_FILE_UNREADABLE");
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<void>((resolve, reject) => {
          if (cancelled) {
            reject(new Error("MEDIA_UPLOAD_CANCELLED"));
            return;
          }
          xhr.open("PUT", input.uploadUrl);
          Object.entries(input.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
              input.onProgress(Math.min(1, event.loaded / event.total));
            }
          };
          xhr.onerror = () => reject(new Error("MEDIA_UPLOAD_FAILED"));
          xhr.onabort = () => reject(new Error("MEDIA_UPLOAD_CANCELLED"));
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              input.onProgress(1);
              resolve();
            } else {
              reject(new Error("MEDIA_UPLOAD_FAILED"));
            }
          };
          xhr.send(blob);
        }),
    )
    .catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === "AbortError")) {
        throw new Error("MEDIA_UPLOAD_CANCELLED");
      }
      throw error;
    });
  return {
    cancel: async () => {
      cancelled = true;
      sourceController.abort();
      if (xhr.readyState !== XMLHttpRequest.UNSENT && xhr.readyState !== XMLHttpRequest.DONE) {
        xhr.abort();
      }
    },
    promise,
  };
}

export function resolveStorageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${path.startsWith("/") ? path : `/${path}`}` : path;
}

export function preferredMediaUrl(
  originalUrl: string,
  variants: unknown,
): string {
  if (variants && typeof variants === "object" && !Array.isArray(variants)) {
    const values = variants as Record<string, unknown>;
    const preferred = values.full ?? values.medium ?? values.original;
    if (preferred && typeof preferred === "object" && !Array.isArray(preferred)) {
      const url = (preferred as Record<string, unknown>).url;
      if (typeof url === "string") return resolveStorageUrl(url);
    }
  }
  return resolveStorageUrl(originalUrl);
}
