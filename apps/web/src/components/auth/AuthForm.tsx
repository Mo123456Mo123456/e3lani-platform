"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";

export function AuthForm({
  mode,
  locale,
  dictionary,
}: {
  mode: "login" | "register";
  locale: Locale;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
      router.push(`/${locale}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-planet" aria-hidden="true"><span /></div>
      <form className="glass-panel auth-card" onSubmit={submit}>
        <Link className="mini-brand" href={`/${locale}`}><i /> {dictionary.brand}</Link>
        <span className="eyebrow">{dictionary.tagline}</span>
        <h1>{isLogin ? dictionary.auth.login : dictionary.auth.register}</h1>
        {!isLogin && (
          <label>
            {dictionary.auth.name}
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
        )}
        <label>
          {dictionary.auth.email}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label>
          {dictionary.auth.password}
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} required />
        </label>
        {error && <p className="form-error">{dictionary.auth.error}</p>}
        <button className="primary-cta" disabled={busy}>
          {busy ? "•••" : isLogin ? dictionary.auth.submitLogin : dictionary.auth.submitRegister}
        </button>
        <p className="auth-switch">
          {isLogin ? dictionary.auth.noAccount : dictionary.auth.hasAccount}{" "}
          <Link href={`/${locale}/${isLogin ? "register" : "login"}`}>
            {isLogin ? dictionary.auth.register : dictionary.auth.login}
          </Link>
        </p>
      </form>
    </main>
  );
}
