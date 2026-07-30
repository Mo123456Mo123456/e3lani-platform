'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminUser = {
  id: string;
  email: string;
  displayName?: string;
  roles: string[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  setSession: (data: {
    accessToken: string;
    refreshToken: string;
    user: AdminUser;
  }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'planet-admin-auth' },
  ),
);
