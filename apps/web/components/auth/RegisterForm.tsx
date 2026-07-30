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

export function RegisterForm() {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.register(email, password, displayName);
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
    <Panel title={dict.auth.registerTitle} className="mx-auto w-full max-w-md">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-xs text-muted">
          {dict.auth.displayName}
          <input
            className="mt-1 w-full rounded-lg border border-cyan/25 bg-slate-950/60 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
          />
        </label>
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
            minLength={8}
          />
        </label>
        {error && <p className="text-xs text-red">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "..." : dict.auth.submitRegister}
        </Button>
        <p className="text-center text-xs text-muted">
          {dict.auth.hasAccount}{" "}
          <Link href="/login" className="text-cyan hover:underline">
            {dict.nav.login}
          </Link>
        </p>
      </form>
    </Panel>
  );
}
