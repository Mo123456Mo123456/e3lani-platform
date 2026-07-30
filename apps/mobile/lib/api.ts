import * as SecureStore from "expo-secure-store";

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const accessKey = "e3lani_access_token";
const refreshKey = "e3lani_refresh_token";

export async function saveSession(session: { accessToken: string; refreshToken: string }) {
  await Promise.all([
    SecureStore.setItemAsync(accessKey, session.accessToken),
    SecureStore.setItemAsync(refreshKey, session.refreshToken),
  ]);
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(accessKey),
    SecureStore.deleteItemAsync(refreshKey),
  ]);
}

async function refreshAccess() {
  const refreshToken = await SecureStore.getItemAsync(refreshKey);
  if (!refreshToken) return null;
  const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await clearSession();
    return null;
  }
  const session = (await response.json()) as { accessToken: string; refreshToken: string };
  await saveSession(session);
  return session.accessToken;
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const accessToken = await SecureStore.getItemAsync(accessKey);
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401 && retry) {
    const refreshed = await refreshAccess();
    if (refreshed) return api<T>(path, init, false);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function isSignedIn() {
  return Boolean(await SecureStore.getItemAsync(accessKey));
}

export { apiUrl };
