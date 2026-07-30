"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useUiStore } from "@/lib/store";

interface SessionResponse {
  accessToken: string;
  user: { id: string; email: string; roles: string[] };
}

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const locale = useUiStore((state) => state.locale);
  const setAccessToken = useUiStore((state) => state.setAccessToken);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const body =
        mode === "register"
          ? {
              email: values.get("email"),
              password: values.get("password"),
              displayName: values.get("displayName"),
              locale,
            }
          : { email: values.get("email"), password: values.get("password") };
      const session = await api<SessionResponse>(`/v1/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAccessToken(session.accessToken);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.code : "تعذر الاتصال بالخادم",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="إغلاق">
          ×
        </button>
        <p className="eyebrow">WORLD IDENTITY</p>
        <h2 id="auth-title">
          {mode === "register" ? "إنشاء مستكشف جديد" : "العودة إلى عالمك"}
        </h2>
        <p className="muted">تُحفظ الجلسة عبر Refresh Token دوّار وآمن.</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              الاسم
              <input
                name="displayName"
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label>
            البريد الإلكتروني
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            كلمة المرور
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
          </label>
          <small>12 حرفًا على الأقل، وتتضمن حرفًا كبيرًا وصغيرًا ورقمًا.</small>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy
              ? "جارٍ التحقق…"
              : mode === "register"
                ? "إنشاء الحساب"
                : "دخول"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setMode(mode === "register" ? "login" : "register")}
        >
          {mode === "register"
            ? "لديك حساب؟ سجّل الدخول"
            : "مستخدم جديد؟ أنشئ حسابًا"}
        </button>
      </section>
    </div>
  );
}
