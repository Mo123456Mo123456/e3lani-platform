import * as React from 'react';
import type { AuthTokensDto, SessionUserDto } from '@e3lani/types';
import { api, tokens } from './api';

interface AuthState {
  user: SessionUserDto | null;
  loading: boolean;
  signIn: (payload: { tokens: AuthTokensDto; user: SessionUserDto }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => undefined,
  signOut: async () => undefined,
  refresh: async () => undefined,
});

export const useAuth = () => React.useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUserDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const token = await tokens.access();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<SessionUserDto>('/auth/me', { auth: true }));
    } catch {
      await tokens.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = React.useCallback(
    async (payload: { tokens: AuthTokensDto; user: SessionUserDto }) => {
      await tokens.save(payload.tokens);
      setUser(payload.user);
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    const refreshToken = await tokens.refresh();
    await api('/auth/logout', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
    await tokens.clear();
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
