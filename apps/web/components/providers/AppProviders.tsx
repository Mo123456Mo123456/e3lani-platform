"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { applyDocumentLocale } from "@/lib/i18n";
import { usePlanetStore } from "@/lib/planet-store";
import { useAuthStore } from "@/lib/auth-store";
import { planetSocket } from "@/lib/ws";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const locale = usePlanetStore((s) => s.locale);
  const token = useAuthStore((s) => s.accessToken);
  const planetId = usePlanetStore((s) => s.planetId);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (token) {
      planetSocket.connect(token, planetId || undefined);
      return () => planetSocket.disconnect();
    }
  }, [token, planetId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
