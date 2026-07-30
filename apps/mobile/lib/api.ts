import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const REFRESH_KEY = "e3lani.refresh-token";
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function storeSession(session: { accessToken: string; refreshToken: string }) {
  accessToken = session.accessToken;
  await SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function refreshSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await clearSession();
    return false;
  }
  const session = (await response.json()) as { accessToken: string; refreshToken: string };
  await storeSession(session);
  return true;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && (await refreshSession())) {
    return api<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string; code?: string }).code ?? (body as { message?: string }).message ?? `API_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function uploadFile(uploadUrl: string, uri: string, mimeType: string) {
  const file = await fetch(uri);
  const blob = await file.blob();
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": mimeType },
    body: blob,
  });
  if (!response.ok) throw new Error("UPLOAD_FAILED");
}
