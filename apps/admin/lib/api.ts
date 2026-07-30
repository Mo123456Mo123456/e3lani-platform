const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getAccessToken() {
  return typeof window === "undefined" ? null : window.sessionStorage.getItem("e3lani_admin_access");
}

export function saveSession(session: { accessToken: string; refreshToken: string }) {
  window.sessionStorage.setItem("e3lani_admin_access", session.accessToken);
  window.sessionStorage.setItem("e3lani_admin_refresh", session.refreshToken);
}

export function clearSession() {
  window.sessionStorage.removeItem("e3lani_admin_access");
  window.sessionStorage.removeItem("e3lani_admin_refresh");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401 || response.status === 403) {
    clearSession();
    if (typeof window !== "undefined") window.location.assign("/login");
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(details?.message ?? `HTTP_${response.status}`);
  }
  return response.json() as Promise<T>;
}
