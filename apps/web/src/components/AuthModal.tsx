"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useAppStore((s) => s.locale);
  const setUser = useAppStore((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("explorer@planet-born.local");
  const [password, setPassword] = useState("Explorer!2026");
  const [displayName, setDisplayName] = useState("مستكشف الكوكب");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, displayName, locale };
      const data = await api<{
        user: {
          id: string;
          email: string;
          displayName: string;
          role: string;
          level: number;
          xp: number;
          locale: "ar" | "en";
        };
        accessToken: string;
        refreshToken: string;
      }>(path, { method: "POST", body: JSON.stringify(body), auth: false });
      localStorage.setItem("pb_access", data.accessToken);
      localStorage.setItem("pb_refresh", data.refreshToken);
      setUser(data.user);
      onClose();
    } catch {
      setError(locale === "ar" ? "تعذر تسجيل الدخول" : "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pb-panel" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === "login" ? t(locale, "login") : t(locale, "register")}</h2>
        {mode === "register" && (
          <label>
            {t(locale, "displayName")}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        <label>
          {t(locale, "email")}
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t(locale, "password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="pb-btn pb-btn-primary" disabled={loading} onClick={submit}>
          {loading ? t(locale, "loading") : mode === "login" ? t(locale, "login") : t(locale, "register")}
        </button>
        <button
          className="linkish"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? t(locale, "register") : t(locale, "login")}
        </button>
      </div>
    </div>
  );
}
