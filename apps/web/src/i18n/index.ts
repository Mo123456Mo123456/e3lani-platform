import ar, { type Dict } from "./ar";
import en from "./en";

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export const DICTS: Record<Locale, Dict> = { ar, en };

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

export function dict(locale: Locale): Dict {
  return DICTS[locale] ?? ar;
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export type { Dict };
