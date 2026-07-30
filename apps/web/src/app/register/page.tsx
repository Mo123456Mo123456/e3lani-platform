"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.register(email, password, displayName);
      setSession(session);
      router.push("/");
    } catch {
      setError(t.auth.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>{t.auth.registerTitle}</h1>
        <input
          required
          minLength={2}
          placeholder={t.auth.displayName}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          type="email"
          required
          placeholder={t.auth.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder={t.auth.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
        />
        {error && <p className="error-line">{error}</p>}
        <button className="primary-btn" type="submit" disabled={busy}>
          {t.auth.submitRegister}
        </button>
        <p className="auth-switch">
          <Link href="/login">{t.auth.toLogin}</Link>
        </p>
      </form>
    </div>
  );
}
