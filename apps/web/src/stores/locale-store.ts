"use client";

import { create } from "zustand";
import { dictionaries, localeMeta } from "@/lib/i18n";
import type { Locale } from "@/types/domain";

const LOCALE_KEY = "planet.locale";

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  hydrate: () => void;
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dir = localeMeta[locale].dir;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: "ar",
  hydrated: false,
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_KEY, locale);
    }
    applyDocumentLocale(locale);
    set({ locale, hydrated: true });
  },
  toggleLocale: () => {
    const nextLocale = get().locale === "ar" ? "en" : "ar";
    get().setLocale(nextLocale);
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(LOCALE_KEY);
    const locale: Locale = stored === "en" ? "en" : "ar";
    applyDocumentLocale(locale);
    set({ locale, hydrated: true });
  },
}));

export function useI18n() {
  const locale = useLocaleStore((state) => state.locale);
  const toggleLocale = useLocaleStore((state) => state.toggleLocale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  return {
    locale,
    dir: localeMeta[locale].dir,
    meta: localeMeta[locale],
    t: dictionaries[locale],
    toggleLocale,
    setLocale,
  };
}
