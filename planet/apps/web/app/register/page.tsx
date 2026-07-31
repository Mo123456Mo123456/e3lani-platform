"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { api, ApiError, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken, user } = await api<{ accessToken: string; user: { id: string; email: string } }>(
        "/auth/register",
        { method: "POST", body: { email, password, displayName, locale } },
      );
      setAccessToken(accessToken);
      setUser({ id: user.id, email: user.email, role: "registered", displayName });
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
        <h1>{t.auth.register}</h1>
        <p className="sub">{t.tagline}</p>
        <input className="input" required minLength={2} placeholder={t.auth.displayName} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input className="input" type="email" required placeholder={t.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <input className="input" type="password" required minLength={8} placeholder={t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner size={14} /> : t.auth.register}
        </Button>
        <Link href="/login" style={{ fontSize: 12, textAlign: "center" }}>
          {t.auth.haveAccount} {t.auth.login}
        </Link>
      </form>
    </div>
  );
}
