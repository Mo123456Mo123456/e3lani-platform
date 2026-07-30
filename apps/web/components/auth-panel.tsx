
"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { login, register } from "../lib/api";
import { dictionaries, type Locale } from "../lib/i18n";
import { useWorldStore } from "../store/world-store";

export function AuthPanel({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const token = useWorldStore((state) => state.token);
  const setToken = useWorldStore((state) => state.setToken);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("creator@kawkab.local");
  const [password, setPassword] = useState("change-me-creator");
  const [displayName, setDisplayName] = useState(locale === "ar" ? "صانع عالم" : "World Maker");

  useEffect(() => {
    const saved = localStorage.getItem("kawkab-token");
    if (saved) setToken(saved);
  }, [setToken]);

  const auth = useMutation({
    mutationFn: async () => mode === "login" ? login(email, password) : register(email, password, displayName),
    onSuccess: (data) => setToken(data.accessToken)
  });

  return (
    <section className="auth-box">
      <strong>{t.auth}</strong>
      <div className="inline-actions">
        <button className={mode === "login" ? "primary-button" : "secondary-button"} onClick={() => setMode("login")}>{t.login}</button>
        <button className={mode === "register" ? "primary-button" : "secondary-button"} onClick={() => setMode("register")}>{t.register}</button>
      </div>
      <input placeholder={t.email} value={email} onChange={(event) => setEmail(event.target.value)} />
      <input placeholder={t.password} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      {mode === "register" ? <input placeholder={t.name} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /> : null}
      <button className="primary-button" onClick={() => auth.mutate()} disabled={auth.isPending}>{auth.isPending ? "..." : mode === "login" ? t.login : t.register}</button>
      <small>{token ? "JWT ready" : t.authRequired}</small>
      {auth.error ? <small className="status-warn">{String(auth.error.message)}</small> : null}
    </section>
  );
}
