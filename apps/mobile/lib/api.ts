import * as SecureStore from "expo-secure-store";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("e3lani.accessToken");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function saveSession(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync("e3lani.accessToken", accessToken),
    SecureStore.setItemAsync("e3lani.refreshToken", refreshToken)
  ]);
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync("e3lani.accessToken"),
    SecureStore.deleteItemAsync("e3lani.refreshToken")
  ]);
}

export const colors = {
  brand: "#FFC400",
  ink: "#111111",
  white: "#FFFFFF",
  muted: "#F7F7F7"
} as const;
