import { create } from "zustand";
import type { Locale } from "../lib/i18n";

export type Quality = "low" | "medium" | "high";

interface WorldStore {
  locale: Locale;
  quality: Quality;
  token: string;
  setLocale(locale: Locale): void;
  setQuality(quality: Quality): void;
  setToken(token: string): void;
}

export const useWorldStore = create<WorldStore>((set) => ({
  locale: "ar",
  quality: "medium",
  token: "",
  setLocale: (locale) => set({ locale }),
  setQuality: (quality) => set({ quality }),
  setToken: (token) => set({ token })
}));
