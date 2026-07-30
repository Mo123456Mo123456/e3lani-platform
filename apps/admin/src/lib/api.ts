const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ApiError = { error: string; required?: string[]; details?: unknown };

function authHeader(token?: string | null): HeadersInit {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  url: API_URL,

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ email, password }),
    });
    return parse<{
      user: { id: string; email: string; displayName: string; roles: string[] };
      accessToken: string;
      refreshToken: string;
    }>(res);
  },

  async me(token: string) {
    const res = await fetch(`${API_URL}/auth/me`, { headers: authHeader(token) });
    return parse<{ id: string; email: string; roles: string[] }>(res);
  },

  async get<T>(path: string, token: string, query?: Record<string, string | undefined>) {
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
          .join('&')
      : '';
    const res = await fetch(`${API_URL}${path}${qs}`, { headers: authHeader(token) });
    return parse<T>(res);
  },

  async post<T>(path: string, token: string, body?: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: authHeader(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parse<T>(res);
  },

  async patch<T>(path: string, token: string, body?: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: authHeader(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parse<T>(res);
  },
};

/** Roles allowed into the admin console */
export const ADMIN_ROLES = ['admin', 'super_admin', 'sim_manager', 'content_mod'] as const;

export function canAccessAdmin(roles: string[]): boolean {
  return roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
}

export function hasRole(roles: string[], ...needed: string[]): boolean {
  if (roles.includes('super_admin') || roles.includes('admin')) return true;
  return needed.some((r) => roles.includes(r));
}
