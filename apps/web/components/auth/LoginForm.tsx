"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export function LoginForm() {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const [email, setEmail] = useState("explorer@planet.local");
  const [password, setPassword] = useState("Explorer@123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: {
          id: res.user.id,
          email: res.user.email,
          displayName: res.user.displayName,
          roles: res.user.roles,
        },
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.contribute.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title={dict.auth.loginTitle} className="mx-auto w-full max-w-md">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-xs text-muted">
          {dict.auth.email}
          <input
            className="mt-1 w-full rounded-lg border border-cyan/25 bg-slate-950/60 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-muted">
          {dict.auth.password}
          <input
            className="mt-1 w-full rounded-lg border border-cyan/25 bg-slate-950/60 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <p className="text-[11px] text-gold/80">{dict.auth.demoHint}</p>
        {error && <p className="text-xs text-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : dict.auth.submitLogin}
        </Button>
        <p className="text-center text-xs text-muted">
          {dict.auth.noAccount}{" "}
          <Link href="/register" className="text-cyan hover:underline">
            {dict.nav.register}
          </Link>
        </p>
      </form>
    </Panel>
  );
}
