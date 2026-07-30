const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string };
    throw new ApiError(response.status, body.code ?? `HTTP_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function realtimeUrl(accessToken: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/v1/realtime?token=${encodeURIComponent(accessToken)}`;
}
