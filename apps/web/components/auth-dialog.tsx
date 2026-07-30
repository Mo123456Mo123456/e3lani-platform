"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { planetApi } from "@/lib/api";
import { useWorldStore } from "@/lib/store";

export function AuthDialog() {
  const open = useWorldStore((state) => state.authOpen);
  const setOpen = useWorldStore((state) => state.setAuthOpen);
  const setUser = useWorldStore((state) => state.setUser);
  const locale = useWorldStore((state) => state.locale);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const user = mode === "login"
        ? await planetApi.login(email, password)
        : await planetApi.register(email, password, displayName);
      setUser(user);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تسجيل الدخول");
    } finally {
      setPending(false);
    }
  };

  const ar = locale === "ar";
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={() => setOpen(false)} aria-label={ar ? "إغلاق" : "Close"}>
          <X size={18} />
        </button>
        <p className="eyebrow">{ar ? "هوية المستكشف" : "Explorer identity"}</p>
        <h2 id="auth-title">{mode === "login" ? (ar ? "الدخول إلى عالمك" : "Enter your world") : (ar ? "إنشاء حساب" : "Create account")}</h2>
        <p className="muted">
          {ar ? "يلزم الحساب لحفظ إضافتك وربط آثارها بك عبر الزمن." : "An account links your contribution and its effects to you over time."}
        </p>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <label>
              <span>{ar ? "الاسم" : "Display name"}</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} required />
            </label>
          )}
          <label>
            <span>{ar ? "البريد الإلكتروني" : "Email"}</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label>
            <span>{ar ? "كلمة المرور" : "Password"}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === "register" ? 12 : 1}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={pending}>
            {pending ? (ar ? "جارٍ التحقق…" : "Checking…") : mode === "login" ? (ar ? "دخول" : "Sign in") : (ar ? "إنشاء الحساب" : "Create account")}
          </button>
        </form>
        <button className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? (ar ? "ليس لديك حساب؟ أنشئه الآن" : "Need an account? Register") : (ar ? "لديك حساب؟ سجل الدخول" : "Already registered? Sign in")}
        </button>
        <div className="sandbox-note">
          {ar ? "Sandbox: admin@planet.local — بيانات الدخول موثقة في README." : "Sandbox credentials are documented in README."}
        </div>
      </section>
    </div>
  );
}
