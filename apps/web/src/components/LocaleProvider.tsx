"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDictionary, type Locale, type MessageKey } from "@/i18n";

interface LocaleCtx {
  locale: Locale;
  t: (key: MessageKey) => string;
}

const Ctx = createContext<LocaleCtx>({ locale: "ar", t: (k) => k });

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = getDictionary(locale);
  return <Ctx.Provider value={{ locale, t: (key: MessageKey) => dict[key] ?? key }}>{children}</Ctx.Provider>;
}

export function useT(): LocaleCtx {
  return useContext(Ctx);
}
