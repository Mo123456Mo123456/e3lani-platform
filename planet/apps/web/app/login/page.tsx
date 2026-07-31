"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { api, ApiError, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAccessToken(accessToken);
      const me = await api<{ id: string; email: string; role: string; profile?: { displayName?: string } }>(
        "/users/me",
        { auth: true },
      );
      setUser({ id: me.id, email: me.email, role: me.role, displayName: me.profile?.displayName });
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-page">
      <form className="form-card" onSubmit={submit}>
        <h1>{t.auth.login}</h1>
        <p className="sub">{t.tagline}</p>
        <input className="input" type="email" required placeholder={t.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <input className="input" type="password" required placeholder={t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner size={14} /> : t.auth.login}
        </Button>
        <Link href="/register" style={{ fontSize: 12, textAlign: "center" }}>
          {t.auth.needAccount} {t.auth.register}
        </Link>
      </form>
    </div>
  );
}
