import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roles?: string[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (data: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "planet-auth" },
  ),
);
