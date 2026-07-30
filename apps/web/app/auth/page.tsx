"use client";

import { useState } from "react";
import { api, saveTokens } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

export default function AuthPage() {
  const locale = useAppStore((s) => s.locale);
  const setUser = useAppStore((s) => s.setUser);
  const d = t(locale);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("explorer@planet-born.local");
  const [password, setPassword] = useState("Explorer!2026");
  const [displayName, setDisplayName] = useState("مستكشف كوكب");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, displayName, locale };
      const res = await api<{
        user: Parameters<typeof setUser>[0];
        accessToken: string;
        refreshToken: string;
      }>(path, { method: "POST", json: body });
      saveTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div className="panel" style={{ width: "min(420px, 100%)", padding: "1.5rem" }}>
        <h1 style={{ marginTop: 0, fontSize: "1.35rem" }}>{d.brand}</h1>
        <p style={{ color: "var(--text-dim)", marginTop: 0 }}>{d.tagline}</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className="btn"
            type="button"
            style={{
              borderColor: mode === "login" ? "var(--cyan)" : undefined,
            }}
            onClick={() => setMode("login")}
          >
            {d.login}
          </button>
          <button
            className="btn"
            type="button"
            style={{
              borderColor: mode === "register" ? "var(--cyan)" : undefined,
            }}
            onClick={() => setMode("register")}
          >
            {d.register}
          </button>
        </div>
        {mode === "register" && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            style={inputStyle}
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={inputStyle}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: "0.85rem", marginBottom: 8 }}>
            {error}
          </div>
        )}
        <button
          className="btn btn-primary"
          type="button"
          style={{ width: "100%" }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? "…" : mode === "login" ? d.login : d.register}
        </button>
        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 12 }}>
          Sandbox: explorer@planet-born.local / Explorer!2026
        </p>
        <a href="/" style={{ fontSize: "0.85rem", color: "var(--cyan)" }}>
          ← {d.home}
        </a>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: 8,
  padding: "0.65rem 0.75rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,0.35)",
  color: "var(--text)",
};
