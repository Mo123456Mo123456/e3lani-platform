"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useUiStore, type GraphicsQuality } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 2, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  const setLocale = useUiStore((state) => state.setLocale);
  const setQuality = useUiStore((state) => state.setQuality);

  useEffect(() => {
    const locale = localStorage.getItem("planet-locale");
    const quality = localStorage.getItem(
      "planet-quality",
    ) as GraphicsQuality | null;
    setLocale(locale === "en" ? "en" : "ar");
    if (quality && ["ultra", "high", "medium", "eco"].includes(quality)) {
      setQuality(quality);
    } else if (navigator.hardwareConcurrency <= 4) {
      setQuality("eco");
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [setLocale, setQuality]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
