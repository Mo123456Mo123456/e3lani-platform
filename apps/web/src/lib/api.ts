"use client";

import { createApiClient } from "@planet/api-client";
import { useAuthStore } from "./auth-store";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let client: ReturnType<typeof createApiClient> | null = null;

export function api() {
  if (!client) {
    client = createApiClient({
      baseUrl,
      getAccessToken: () => useAuthStore.getState().accessToken,
      onTokens: (tokens) => {
        useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
        client?.setRefreshToken(tokens.refreshToken);
      },
      onUnauthorized: () => useAuthStore.getState().clear(),
    });
    client.setRefreshToken(useAuthStore.getState().refreshToken);
  }
  return client;
}
