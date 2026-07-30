import { ar, type MessageKey } from "./ar";
import { en } from "./en";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { ar, en };

export function getDictionary(locale: Locale): Record<MessageKey, string> {
  return dictionaries[locale] ?? dictionaries.ar;
}

export function isLocale(value: string | undefined): value is Locale {
  return value === "ar" || value === "en";
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** minimal type-safe translator factory */
export function makeT(locale: Locale) {
  const dict = getDictionary(locale);
  return (key: MessageKey): string => dict[key] ?? key;
}

export type { MessageKey };
