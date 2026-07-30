"use client";

import { create } from "zustand";
import type { AuthUser } from "@/types/domain";

const TOKEN_KEY = "planet.auth.token";
const USER_KEY = "planet.auth.user";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ token, user, hydrated: true });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
    set({ token: null, user: null, hydrated: true });
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const token = window.localStorage.getItem(TOKEN_KEY);
    const rawUser = window.localStorage.getItem(USER_KEY);
    let user: AuthUser | null = null;

    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as AuthUser;
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }

    set({ token, user, hydrated: true });
  },
}));

export function getAuthToken() {
  return useAuthStore.getState().token;
}
