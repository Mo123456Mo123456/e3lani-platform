"use client";

import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Locale } from "@/i18n";
import { queryClient } from "@/lib/query";
import { LocaleProvider } from "@/components/LocaleProvider";
import { TopBar } from "@/components/panels/TopBar";

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale={locale}>
        <TopBar />
        <main className="pt-12">{children}</main>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
