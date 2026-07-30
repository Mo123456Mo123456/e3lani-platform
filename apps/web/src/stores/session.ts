"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApiUser } from "@/lib/api";

type SessionState = {
  token: string | null;
  user: ApiUser | null;
  locale: "ar" | "en";
  setSession: (token: string, user: ApiUser) => void;
  clear: () => void;
  setLocale: (locale: "ar" | "en") => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      locale: "ar",
      setSession: (token, user) => set({ token, user, locale: (user.locale as "ar" | "en") ?? "ar" }),
      clear: () => set({ token: null, user: null }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: "planet-session" },
  ),
);
