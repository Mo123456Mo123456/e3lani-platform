"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Input, Label, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api().login({ email, password });
      setSession(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      api().setRefreshToken(res.tokens.refreshToken);
      router.push(`/${locale}`);
    } catch {
      setError(dict.auth.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>{dict.auth.loginTitle}</h1>
        <p className="pb-dim" style={{ fontSize: 13 }}>{dict.tagline}</p>
        <form onSubmit={submit}>
          <Label>{dict.auth.email}</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" />
          <div style={{ height: 12 }} />
          <Label>{dict.auth.password}</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" />
          <div style={{ height: 16 }} />
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div style={{ height: 12 }} />
          <Button variant="primary" block disabled={busy} type="submit">
            {busy ? <Spinner /> : dict.nav.login}
          </Button>
        </form>
        <hr className="pb-divider" />
        <div style={{ fontSize: 13 }}>
          {dict.auth.noAccount}{" "}
          <Link href={`/${locale}/register`} style={{ color: "var(--pb-tech)" }}>
            {dict.nav.register}
          </Link>
        </div>
        <div className="pb-faint" style={{ fontSize: 11, marginTop: 12 }}>{dict.auth.oauthNote}</div>
      </Card>
    </div>
  );
}
