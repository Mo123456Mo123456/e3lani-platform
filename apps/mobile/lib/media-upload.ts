import type { ImagePickerAsset } from "expo-image-picker";

import { api } from "./api";

async function waitUntilReady(mediaId: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const media = await api<{ status: string; failureReason?: string }>(`/media/${mediaId}`);
    if (media.status === "READY") return mediaId;
    if (media.status === "FAILED") throw new Error(media.failureReason ?? "MEDIA_PROCESSING_FAILED");
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("MEDIA_PROCESSING_TIMEOUT");
}

export async function uploadMediaAsset(asset: ImagePickerAsset) {
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const mimeType =
    asset.mimeType ??
    (asset.type === "video"
      ? "video/mp4"
      : asset.uri.endsWith(".png")
        ? "image/png"
        : "image/jpeg");
  const ticket = await api<{
    mediaId: string;
    uploadUrl: string;
    headers: Record<string, string>;
  }>("/media/uploads", {
    method: "POST",
    body: JSON.stringify({
      fileName: asset.fileName ?? `upload.${asset.type === "video" ? "mp4" : "jpg"}`,
      mimeType,
      bytes: asset.fileSize ?? blob.size,
    }),
  });
  const uploaded = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: ticket.headers,
    body: blob,
  });
  if (!uploaded.ok) throw new Error("MEDIA_UPLOAD_FAILED");
  await api(`/media/${ticket.mediaId}/finalize`, { method: "POST" });
  return waitUntilReady(ticket.mediaId);
}
