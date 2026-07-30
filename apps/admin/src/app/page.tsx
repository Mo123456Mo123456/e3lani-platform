"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@planet-born.local");
  const [password, setPassword] = useState("PlanetAdmin!2026");
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<{
    users: number;
    contributions: number;
    aiRequests: number;
    planet: { status: string; tick: number; year: number; metrics: Record<string, number> } | null;
    recentTicks: Array<{ tick: number; eventCount: number; durationMs: number }>;
  } | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; displayName: string; role: string }>>([]);
  const [ai, setAi] = useState<{ totalCostUsd: number; sandboxOnly: boolean; requests: Array<{ purpose: string; provider: string; sandbox: boolean }> } | null>(null);

  async function login() {
    setError(null);
    const res = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.messageAr ?? "فشل الدخول");
      return;
    }
    if (!["super_admin", "system_admin", "simulation_manager", "content_moderator"].includes(data.user.role)) {
      setError("هذا الحساب ليس إداريًا");
      return;
    }
    setToken(data.accessToken);
    localStorage.setItem("pb_admin_access", data.accessToken);
  }

  async function load() {
    const t = token || localStorage.getItem("pb_admin_access");
    if (!t) return;
    setToken(t);
    const headers = { Authorization: `Bearer ${t}` };
    const [ov, us, aiRes] = await Promise.all([
      fetch(`${API}/v1/admin/overview`, { headers }).then((r) => r.json()),
      fetch(`${API}/v1/admin/users`, { headers }).then((r) => r.json()),
      fetch(`${API}/v1/admin/ai`, { headers }).then((r) => r.json()),
    ]);
    if (ov.error) {
      setError(ov.messageAr ?? ov.message);
      return;
    }
    setOverview(ov);
    setUsers(us.users ?? []);
    setAi(aiRes);
  }

  useEffect(() => {
    const t = localStorage.getItem("pb_admin_access");
    if (t) {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (token) load().catch(console.error);
  }, [token]);

  async function pause(resume = false) {
    await fetch(`${API}/v1/admin/simulation/${resume ? "resume" : "pause"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  if (!token) {
    return (
      <div className="wrap">
        <h1>لوحة إدارة — كوكب يولد أمامك</h1>
        <p className="muted">غير مرتبطة بواجهة المستخدم العامة. حسابات Sandbox في README فقط.</p>
        <div className="card" style={{ display: "grid", gap: ".7rem", maxWidth: 420 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
          {error && <div className="error">{error}</div>}
          <button onClick={login}>دخول الإدارة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1>لوحة الإدارة</h1>
      <p className="muted">مراقبة المحاكاة والمستخدمين واستهلاك الذكاء الاصطناعي</p>
      {error && <div className="error">{error}</div>}

      <div className="grid">
        <div className="card stat">
          <span>المستخدمون</span>
          <b>{overview?.users ?? "—"}</b>
        </div>
        <div className="card stat">
          <span>المساهمات</span>
          <b>{overview?.contributions ?? "—"}</b>
        </div>
        <div className="card stat">
          <span>طلبات AI</span>
          <b>{overview?.aiRequests ?? "—"}</b>
        </div>
        <div className="card stat">
          <span>حالة الكوكب</span>
          <b>{overview?.planet?.status ?? "—"}</b>
        </div>
      </div>

      <div className="card">
        <h3>المحاكاة</h3>
        <p>
          Tick {overview?.planet?.tick} · Year {overview?.planet?.year?.toFixed?.(1)} · Pollution{" "}
          {overview?.planet?.metrics?.globalPollution}
        </p>
        <div style={{ display: "flex", gap: ".5rem" }}>
          <button onClick={() => pause(false)}>إيقاف</button>
          <button onClick={() => pause(true)}>تشغيل</button>
          <button onClick={load}>تحديث</button>
        </div>
      </div>

      <div className="card">
        <h3>الذكاء الاصطناعي</h3>
        <p>
          التكلفة: ${ai?.totalCostUsd ?? 0} ·{" "}
          {ai?.sandboxOnly ? "Sandbox فقط (لا مفاتيح خارجية نشطة)" : "مزود خارجي نشط"}
        </p>
      </div>

      <div className="card">
        <h3>المستخدمون</h3>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد</th>
              <th>الدور</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
