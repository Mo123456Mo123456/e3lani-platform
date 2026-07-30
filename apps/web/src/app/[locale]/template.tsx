"use client";

import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { isLocale, type Locale } from "@/i18n";
import { queryClient } from "@/lib/query";
import { LocaleProvider } from "@/components/LocaleProvider";
import { TopBar } from "@/components/panels/TopBar";

export default function LocaleTemplate({ children, params }: { children: ReactNode; params: { locale: string } }) {
  const locale: Locale = isLocale(params.locale) ? params.locale : "ar";
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
