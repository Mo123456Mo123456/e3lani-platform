"use client";

import { createContext, useContext } from "react";
import type { Dict, Locale } from "@/i18n";

export const I18nContext = createContext<{ locale: Locale; dict: Dict; dir: "rtl" | "ltr" }>({
  locale: "ar",
  dict: ({} as Dict),
  dir: "rtl",
});

export function useI18n() {
  return useContext(I18nContext);
}
