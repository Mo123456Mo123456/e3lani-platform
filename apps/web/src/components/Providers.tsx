"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@planet/ui";
import { dict, dirOf, type Locale } from "@/i18n";
import { I18nContext } from "./i18n-context";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
    document.cookie = `pb_locale=${locale};path=/;max-age=31536000`;
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [locale]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <I18nContext.Provider value={{ locale, dict: dict(locale), dir: dirOf(locale) }}>
          {children}
        </I18nContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
