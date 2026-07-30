export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const ADMIN_SESSION_KEY = "planet-born-admin-auth";

export type AdminSession = {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
};

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) ?? "null") as AdminSession | null;
  } catch {
    return null;
  }
}

export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getAdminSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error((await response.text()) || `Admin API failed (${response.status})`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export async function adminLogin(email: string, password: string) {
  const session = await adminApi<AdminSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!["system_admin", "super_admin"].includes(session.user.role)) {
    throw new Error("INSUFFICIENT_ROLE");
  }
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
}
