import AsyncStorage from "@react-native-async-storage/async-storage";

const ANALYTICS_ID_KEY = "e3lani.analytics.anonymous-id.v1";

function randomPart() {
  return Math.random().toString(36).slice(2, 12);
}

export function createIdempotencyKey(eventType: string, publicAdId: string) {
  return `${eventType}-${publicAdId}-${Date.now().toString(36)}-${randomPart()}`;
}

export async function getOrCreateAnonymousId() {
  const stored = await AsyncStorage.getItem(ANALYTICS_ID_KEY);
  if (stored && stored.length >= 8) return stored;

  const created = `anon-${Date.now().toString(36)}-${randomPart()}-${randomPart()}`;
  await AsyncStorage.setItem(ANALYTICS_ID_KEY, created);
  return created;
}
