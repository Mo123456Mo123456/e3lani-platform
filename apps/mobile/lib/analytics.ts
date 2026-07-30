import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "./api";

const KEY = "e3lani.anonymous-id";
let cachedId: string | undefined;

async function anonymousId() {
  if (cachedId) return cachedId;
  cachedId = (await AsyncStorage.getItem(KEY)) ?? undefined;
  if (!cachedId) {
    cachedId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(KEY, cachedId);
  }
  return cachedId;
}

export async function trackAdEvent(
  distributionId: string,
  type:
    | "IMPRESSION"
    | "VIEW"
    | "VIDEO_START"
    | "VIDEO_COMPLETE"
    | "WHATSAPP_CLICK"
    | "STORE_CLICK"
    | "PHONE_CLICK"
    | "SHARE",
  watchMs?: number,
) {
  await api("/content/events", {
    method: "POST",
    body: JSON.stringify({
      distributionId,
      type,
      anonymousId: await anonymousId(),
      watchMs,
      source: "ORGANIC",
    }),
  }).catch(() => undefined);
}
