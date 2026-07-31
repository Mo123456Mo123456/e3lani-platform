"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorBox, Input, Label, Spinner } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function RegisterPage() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api().register({ email, password, displayName, locale });
      setSession(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      api().setRefreshToken(res.tokens.refreshToken);
      router.push(`/${locale}`);
    } catch (err) {
      setError((err as Error).message ?? dict.auth.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>{dict.auth.registerTitle}</h1>
        <p className="pb-dim" style={{ fontSize: 13 }}>{dict.tagline}</p>
        <form onSubmit={submit}>
          <Label>{dict.auth.displayName}</Label>
          <Input required minLength={2} maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <div style={{ height: 12 }} />
          <Label>{dict.auth.email}</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" />
          <div style={{ height: 12 }} />
          <Label>{dict.auth.password}</Label>
          <Input type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" dir="ltr" />
          <div className="pb-faint" style={{ fontSize: 11, marginTop: 4 }}>10+ · Aa0</div>
          <div style={{ height: 16 }} />
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div style={{ height: 12 }} />
          <Button variant="primary" block disabled={busy} type="submit">
            {busy ? <Spinner /> : dict.nav.register}
          </Button>
        </form>
        <hr className="pb-divider" />
        <div style={{ fontSize: 13 }}>
          {dict.auth.haveAccount}{" "}
          <Link href={`/${locale}/login`} style={{ color: "var(--pb-tech)" }}>
            {dict.nav.login}
          </Link>
        </div>
      </Card>
    </div>
  );
}
