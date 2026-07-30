"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { usePlanetStore } from "@/stores/planet-store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    useLocaleStore.getState().hydrate();
    useAuthStore.getState().hydrate();
    usePlanetStore.getState().hydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
