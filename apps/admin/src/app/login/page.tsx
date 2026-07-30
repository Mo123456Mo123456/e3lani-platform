'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, canAccessAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.login(email, password);
      if (!canAccessAdmin(data.user.roles || [])) {
        setError('Access denied — admin roles required (admin, super_admin, sim_manager, content_mod).');
        return;
      }
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
          roles: data.user.roles,
        },
      });
      track('login', { app: 'admin', roles: data.user.roles.join(',') });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-accent)]">
            كوكب يولد أمامك
          </h1>
          <p className="mt-2 text-sm text-fg-muted">Super Admin / Ops Console</p>
        </div>
        <form onSubmit={onSubmit} className="admin-card space-y-4">
          <div>
            <label className="mb-1 block text-xs text-fg-muted">Email</label>
            <input
              className="admin-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-fg-muted">Password</label>
            <input
              className="admin-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="admin-btn w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-fg-muted">
          Credentials are documented in the project README only. No public web link points here.
        </p>
      </div>
    </div>
  );
}
