"use client";

import { createApiClient } from "@planet/api-client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserDto } from "@planet/shared-types";

interface AdminAuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (u: UserDto, a: string, r: string) => void;
  setTokens: (a: string, r: string) => void;
  clear: () => void;
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "pb-admin-auth" },
  ),
);

let client: ReturnType<typeof createApiClient> | null = null;

export function api() {
  if (!client) {
    client = createApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
      getAccessToken: () => useAdminAuth.getState().accessToken,
      onTokens: (t) => {
        useAdminAuth.getState().setTokens(t.accessToken, t.refreshToken);
        client?.setRefreshToken(t.refreshToken);
      },
      onUnauthorized: () => useAdminAuth.getState().clear(),
    });
    client.setRefreshToken(useAdminAuth.getState().refreshToken);
  }
  return client;
}
