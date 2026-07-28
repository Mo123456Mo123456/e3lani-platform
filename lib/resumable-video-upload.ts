import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { PreparedMedia, UploadController } from "./media-upload";

type UploadedPart = {
  partNumber: number;
  size: number;
  etag: string;
};

type MediaAsset = {
  id: number;
  mediaType: "image" | "video";
  originalUrl: string;
  variants: unknown;
};

type ResumableSession = {
  ticket: string;
  partBytes: number;
  totalParts: number;
  expiresAt: string;
  uploadedParts: UploadedPart[];
};

type ResumableStatus = {
  completed: boolean;
  asset: MediaAsset | null;
  partBytes: number;
  totalParts: number;
  expiresAt: string;
  uploadedParts: UploadedPart[];
};

export type ResumableVideoApi = {
  prepare: (input: {
    fileName: string;
    mimeType: "video/mp4";
    bytes: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  }) => Promise<ResumableSession>;
  status: (ticket: string) => Promise<ResumableStatus>;
  signPart: (
    ticket: string,
    partNumber: number,
  ) => Promise<{
    partNumber: number;
    bytes: number;
    uploadUrl: string;
    headers: Record<string, string>;
  }>;
  complete: (ticket: string) => Promise<MediaAsset>;
  abort: (ticket: string) => Promise<unknown>;
};

type PersistedSession = {
  ticket: string;
  expiresAt: string;
};

function fingerprint(media: PreparedMedia) {
  const source = [
    media.fileName.toLowerCase(),
    media.bytes,
    media.durationMs ?? 0,
    media.width ?? 0,
    media.height ?? 0,
  ].join(":");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function persistenceKey(media: PreparedMedia) {
  return `e3lani.resumable-video.v1.${fingerprint(media)}`;
}

async function readPersistedSession(media: PreparedMedia) {
  const key = persistenceKey(media);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PersistedSession;
    if (!value.ticket || new Date(value.expiresAt).getTime() <= Date.now()) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

async function persistSession(media: PreparedMedia, session: PersistedSession) {
  await AsyncStorage.setItem(persistenceKey(media), JSON.stringify(session));
}

async function clearSession(media: PreparedMedia) {
  await AsyncStorage.removeItem(persistenceKey(media));
}

function uploadWebPart(input: {
  url: string;
  headers: Record<string, string>;
  blob: Blob;
  onProgress: (fraction: number) => void;
  setAbort: (abort: () => void) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    input.setAbort(() => request.abort());
    request.open("PUT", input.url);
    for (const [key, value] of Object.entries(input.headers)) {
      request.setRequestHeader(key, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        input.onProgress(event.loaded / event.total);
      }
    };
    request.onerror = () => reject(new Error("MEDIA_RESUME_PART_UPLOAD_FAILED"));
    request.onabort = () => reject(new Error("MEDIA_UPLOAD_CANCELLED"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`MEDIA_RESUME_PART_UPLOAD_FAILED_${request.status}`));
    };
    request.send(input.blob);
  });
}

async function uploadNativePart(input: {
  media: PreparedMedia;
  partNumber: number;
  start: number;
  length: number;
  url: string;
  headers: Record<string, string>;
  onProgress: (fraction: number) => void;
  setAbort: (abort: () => Promise<void>) => void;
}) {
  if (!FileSystem.cacheDirectory) throw new Error("MEDIA_CACHE_UNAVAILABLE");
  const temporaryUri = `${FileSystem.cacheDirectory}e3lani-video-${fingerprint(input.media)}-${input.partNumber}.part`;
  try {
    const base64 = await FileSystem.readAsStringAsync(input.media.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: input.start,
      length: input.length,
    });
    await FileSystem.writeAsStringAsync(temporaryUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const task = FileSystem.createUploadTask(
      input.url,
      temporaryUri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: input.headers,
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      },
      (progress) => {
        if (progress.totalBytesExpectedToSend > 0) {
          input.onProgress(progress.totalBytesSent / progress.totalBytesExpectedToSend);
        }
      },
    );
    input.setAbort(async () => {
      await task.cancelAsync().catch(() => undefined);
    });
    const response = await task.uploadAsync();
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(`MEDIA_RESUME_PART_UPLOAD_FAILED_${response?.status ?? "NO_RESPONSE"}`);
    }
  } finally {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  }
}

export function startResumableVideoUpload(input: {
  media: PreparedMedia;
  api: ResumableVideoApi;
  onProgress?: (fraction: number) => void;
}): UploadController & { promise: Promise<MediaAsset> } {
  if (input.media.kind !== "video" || input.media.mimeType !== "video/mp4") {
    throw new Error("MEDIA_RESUME_VIDEO_ONLY");
  }

  let cancelled = false;
  let ticket = "";
  let abortCurrent: (() => void | Promise<void>) | null = null;

  const promise = (async () => {
    let session: ResumableSession | ResumableStatus;
    const persisted = await readPersistedSession(input.media);
    if (persisted) {
      ticket = persisted.ticket;
      try {
        session = await input.api.status(ticket);
        if (session.completed && session.asset) {
          await clearSession(input.media);
          input.onProgress?.(1);
          return session.asset;
        }
      } catch {
        ticket = "";
        await clearSession(input.media);
        session = await input.api.prepare({
          fileName: input.media.fileName,
          mimeType: "video/mp4",
          bytes: input.media.bytes,
          width: input.media.width,
          height: input.media.height,
          durationMs: input.media.durationMs,
        });
      }
    } else {
      session = await input.api.prepare({
        fileName: input.media.fileName,
        mimeType: "video/mp4",
        bytes: input.media.bytes,
        width: input.media.width,
        height: input.media.height,
        durationMs: input.media.durationMs,
      });
    }

    ticket = session.ticket ?? ticket;
    if (!ticket) throw new Error("MEDIA_RESUME_TICKET_INVALID");
    await persistSession(input.media, { ticket, expiresAt: session.expiresAt });
    if (cancelled) {
      await input.api.abort(ticket).catch(() => undefined);
      await clearSession(input.media);
      throw new Error("MEDIA_UPLOAD_CANCELLED");
    }

    const uploaded = new Map(session.uploadedParts.map((part) => [part.partNumber, part]));
    let completedBytes = session.uploadedParts.reduce((total, part) => total + part.size, 0);
    input.onProgress?.(Math.min(completedBytes / input.media.bytes, 0.98));

    let webBlob: Blob | null = null;
    if (Platform.OS === "web") {
      const response = await fetch(input.media.uri);
      if (!response.ok) throw new Error("MEDIA_READ_FAILED");
      webBlob = await response.blob();
      if (webBlob.size !== input.media.bytes) throw new Error("MEDIA_SIZE_MISMATCH");
    }

    for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
      if (uploaded.has(partNumber)) continue;
      if (cancelled) throw new Error("MEDIA_UPLOAD_CANCELLED");

      const signed = await input.api.signPart(ticket, partNumber);
      const start = (partNumber - 1) * session.partBytes;
      const length = signed.bytes;
      const reportPartProgress = (fraction: number) => {
        const uploadedBytes = completedBytes + length * Math.min(Math.max(fraction, 0), 1);
        input.onProgress?.(Math.min(uploadedBytes / input.media.bytes, 0.98));
      };

      if (Platform.OS === "web") {
        if (!webBlob) throw new Error("MEDIA_READ_FAILED");
        await uploadWebPart({
          url: signed.uploadUrl,
          headers: signed.headers,
          blob: webBlob.slice(start, start + length, "video/mp4"),
          onProgress: reportPartProgress,
          setAbort: (abort) => {
            abortCurrent = abort;
          },
        });
      } else {
        await uploadNativePart({
          media: input.media,
          partNumber,
          start,
          length,
          url: signed.uploadUrl,
          headers: signed.headers,
          onProgress: reportPartProgress,
          setAbort: (abort) => {
            abortCurrent = abort;
          },
        });
      }
      abortCurrent = null;
      completedBytes += length;
      input.onProgress?.(Math.min(completedBytes / input.media.bytes, 0.98));
    }

    if (cancelled) throw new Error("MEDIA_UPLOAD_CANCELLED");
    const asset = await input.api.complete(ticket);
    await clearSession(input.media);
    input.onProgress?.(1);
    return asset;
  })();

  return {
    promise,
    cancel: async () => {
      cancelled = true;
      const abort = abortCurrent;
      abortCurrent = null;
      if (abort) await abort();
      if (ticket) await input.api.abort(ticket).catch(() => undefined);
      await clearSession(input.media);
    },
  };
}
