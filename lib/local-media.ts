import * as FileSystem from "expo-file-system/legacy";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

function extensionFor(asset: ImagePickerAsset) {
  const fileExtension = asset.fileName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "");
  if (fileExtension) return fileExtension.toLowerCase();
  if (asset.type === "video") return "mp4";
  if (asset.mimeType === "image/png") return "png";
  if (asset.mimeType === "image/webp") return "webp";
  return "jpg";
}

async function browserDataUrl(asset: ImagePickerAsset) {
  const blob = asset.file ?? await fetch(asset.uri).then((response) => response.blob());
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("MEDIA_FILE_UNREADABLE"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Moves picker output out of temporary caches before it is stored locally.
 * Large web videos intentionally keep their object URL because encoding them
 * would exceed browser storage quotas; images and all native media are durable.
 */
export async function persistPickedMedia(asset: ImagePickerAsset) {
  if (Platform.OS === "web") {
    return asset.type === "video" ? asset.uri : browserDataUrl(asset);
  }

  if (!FileSystem.documentDirectory) return asset.uri;
  const destination =
    `${FileSystem.documentDirectory}e3lani-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extensionFor(asset)}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}
