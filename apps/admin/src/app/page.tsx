"use client";

import { useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AdminStatus {
  simulation: { status: string; tick: number; version: number };
  moderation: { pending: string };
  ai: Array<{ provider: string; requests: string; cost: string }>;
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState("");

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const response = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
    });
    if (!response.ok) return setError("بيانات الدخول غير صحيحة");
    const session = (await response.json()) as { accessToken: string };
    const admin = await fetch(`${API}/v1/admin/status`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (!admin.ok) return setError("الحساب لا يملك صلاحية الإدارة");
    setToken(session.accessToken);
    setStatus((await admin.json()) as AdminStatus);
  };

  if (!token || !status) {
    return (
      <main className="admin-login">
        <form onSubmit={login}>
          <small>RESTRICTED · RBAC</small>
          <h1>إدارة محرك العالم</h1>
          <p>هذه الواجهة منفصلة ولا يظهر رابطها في تطبيق المستخدم.</p>
          <label>البريد<input name="email" type="email" required /></label>
          <label>كلمة المرور<input name="password" type="password" required /></label>
          {error && <strong>{error}</strong>}
          <button>دخول آمن</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside>
        <h2>Planet Control</h2>
        {["نظرة عامة", "المحاكاة", "المساهمات", "المستخدمون", "المراجعة", "تكلفة الذكاء", "سجل العمليات"].map(
          (item, index) => <button className={index === 0 ? "active" : ""} key={item}>{item}</button>,
        )}
      </aside>
      <section>
        <header><div><small>LIVE OPERATIONS</small><h1>لوحة التحكم</h1></div><span>{status.simulation.status}</span></header>
        <div className="metrics">
          <article><small>Tick</small><strong>{status.simulation.tick}</strong></article>
          <article><small>World version</small><strong>{status.simulation.version}</strong></article>
          <article><small>Moderation queue</small><strong>{status.moderation.pending}</strong></article>
          <article><small>AI cost</small><strong>${status.ai.reduce((sum, row) => sum + Number(row.cost), 0).toFixed(4)}</strong></article>
        </div>
        <article className="ops-card">
          <h2>حالة المزودين</h2>
          {status.ai.length ? status.ai.map((row) => (
            <div key={row.provider}><span>{row.provider}</span><b>{row.requests} طلب</b><em>${row.cost}</em></div>
          )) : <p>لم تُنفذ طلبات تحليل بعد.</p>}
        </article>
        <p className="phase-note">تشغيل/إيقاف Ticks وRollback ومراجعة المحتوى موصولة في API تدريجيًا؛ الأزرار غير المنفذة لا تُعرض كعمليات ناجحة.</p>
      </section>
    </main>
  );
}
