"use client";

import { useState, type CSSProperties } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/stores/session";
import { messages } from "@/i18n/messages";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setSession, locale } = useSession();
  const t = messages[locale];
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("explorer@planet.local");
  const [password, setPassword] = useState("Explorer!23");
  const [displayName, setDisplayName] = useState("مستكشف كوكب");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, displayName, locale });
      setSession(res.accessToken, res.user);
      onClose();
    } catch (e) {
      setError(locale === "ar" ? "فشل تسجيل الدخول / التسجيل" : "Auth failed");
      void e;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,14,0.72)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="planet-panel"
        style={{ width: 400, maxWidth: "92vw", padding: "1.25rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{mode === "login" ? t.login : t.register}</h2>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {mode === "register" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="الاسم"
              style={inputStyle}
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            style={inputStyle}
          />
          {error && <div style={{ color: "var(--planet-red)", fontSize: "0.85rem" }}>{error}</div>}
          <button className="planet-btn planet-btn-primary" disabled={loading} onClick={submit}>
            {loading ? "..." : mode === "login" ? t.login : t.register}
          </button>
          <button
            className="planet-btn planet-btn-ghost"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? t.register : t.login}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.8rem",
  borderRadius: 10,
  border: "1px solid var(--planet-border)",
  background: "rgba(15,23,42,0.8)",
  color: "var(--planet-text)",
};
