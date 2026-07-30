"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, getAdminSession } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = getAdminSession();
    if (session && ["system_admin", "super_admin"].includes(session.user.role)) router.replace("/dashboard");
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminLogin(email, password);
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "INSUFFICIENT_ROLE"
        ? "هذا الحساب لا يملك صلاحيات إدارة النظام."
        : "تعذر تسجيل الدخول. تحقق من البيانات واتصال الخادم.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login">
      <div className="login-grid" />
      <form className="admin-panel login-panel" onSubmit={submit}>
        <div className="login-emblem"><span>◉</span></div>
        <small>PLANET-BORN / RESTRICTED ACCESS</small>
        <h1>مركز تحكم الكوكب</h1>
        <p>الدخول متاح لمسؤولي النظام فقط</p>
        <label>البريد الإلكتروني<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
        {error && <div className="admin-error">{error}</div>}
        <button className="admin-primary" disabled={busy}>{busy ? "جارٍ التحقق…" : "دخول آمن"}</button>
      </form>
    </main>
  );
}
