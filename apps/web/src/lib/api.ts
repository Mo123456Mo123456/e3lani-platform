import { z } from "zod";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const tokenKey = "planet-born-auth";

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; name: string; email: string; role?: string };
};

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(tokenKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(tokenKey);
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(tokenKey, JSON.stringify(session));
  else localStorage.removeItem(tokenKey);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>,
): Promise<T> {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API request failed (${response.status})`);
  }

  const data: unknown = response.status === 204 ? undefined : await response.json();
  return schema ? schema.parse(data) : (data as T);
}

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  createdAt: z.string().optional(),
  time: z.string().optional(),
  importance: z.enum(["low", "medium", "high"]).default("low"),
  category: z.string().default("nature"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type WorldEvent = z.infer<typeof eventSchema>;

export async function login(email: string, password: string) {
  const result = await api<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveSession(result);
  return result;
}

export async function register(name: string, email: string, password: string) {
  const result = await api<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  saveSession(result);
  return result;
}
