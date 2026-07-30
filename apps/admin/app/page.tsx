"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Session = {
  accessToken: string;
  user: { email: string; role: string };
};

type Stats = {
  users: number;
  contributions: number;
  events: number;
  ticks: number;
  aiCost: string;
};

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? body.detail ?? `HTTP_${response.status}`);
  return body as T;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session>();
  const [stats, setStats] = useState<Stats>();
  const [planet, setPlanet] = useState<{ tick: number; year: number; status: string }>();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = async (activeSession = session) => {
    if (!activeSession) return;
    const [nextStats, world] = await Promise.all([
      api<Stats>("/system/admin/stats", undefined, activeSession.accessToken),
      api<{ planet: typeof planet }>("/world"),
    ]);
    setStats(nextStats);
    setPlanet(world.planet);
  };

  useEffect(() => {
    if (!session) return;
    void refresh(session);
    const interval = window.setInterval(() => void refresh(session), 10_000);
    return () => window.clearInterval(interval);
  }, [session]);

  const login = async () => {
    setWorking(true);
    setError("");
    try {
      const next = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!["super_admin", "system_admin", "simulation_admin"].includes(next.user.role)) {
        throw new Error("الحساب لا يملك صلاحية لوحة الإدارة");
      }
      setSession(next);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const tick = async (yearsPerTick: 1 | 10) => {
    if (!session) return;
    setWorking(true);
    setError("");
    try {
      await api("/simulation/tick", {
        method: "POST",
        body: JSON.stringify({ yearsPerTick }),
      }, session.accessToken);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setWorking(false);
    }
  };

  if (!session) {
    return (
      <main className="login">
        <form onSubmit={(event) => { event.preventDefault(); void login(); }}>
          <span className="logo">◉</span>
          <h1>إدارة محاكاة الكوكب</h1>
          <p>منطقة مستقلة محمية بصلاحيات RBAC. لا تُعرض بيانات Sandbox هنا.</p>
          <label>البريد الإلكتروني<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>كلمة المرور<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></label>
          <button disabled={working}>{working ? "جارٍ التحقق…" : "دخول آمن"}</button>
          {error && <output>{error}</output>}
        </form>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <aside>
        <div className="admin-brand"><span>◉</span><b>مركز تحكم العالم</b></div>
        {["نظرة عامة", "المحاكاة", "المساهمات", "المستخدمون", "الأحداث", "تكلفة الذكاء الاصطناعي", "سجل التدقيق"].map((item, index) => (
          <button className={index === 0 ? "active" : ""} disabled={index > 1} key={item}>{item}{index > 1 && <small>غير مفعّل</small>}</button>
        ))}
        <footer>{session.user.email}<small>{session.user.role}</small></footer>
      </aside>
      <section className="content">
        <header><div><h1>حالة النظام</h1><p>قراءات مباشرة من قاعدة البيانات ومحرك المحاكاة</p></div><i>متصل</i></header>
        <div className="metrics">
          <article><span>المستخدمون</span><b>{stats?.users ?? "—"}</b></article>
          <article><span>المساهمات</span><b>{stats?.contributions ?? "—"}</b></article>
          <article><span>الأحداث المحفوظة</span><b>{stats?.events ?? "—"}</b></article>
          <article><span>Ticks المنفذة</span><b>{stats?.ticks ?? "—"}</b></article>
          <article><span>تكلفة AI</span><b>${stats?.aiCost ?? "0"}</b></article>
        </div>
        <div className="panels">
          <article>
            <h2>محرك المحاكاة</h2>
            <dl><div><dt>الحالة</dt><dd>{planet?.status ?? "—"}</dd></div><div><dt>Tick الحالي</dt><dd>{planet?.tick ?? "—"}</dd></div><div><dt>السنة</dt><dd>{planet?.year ?? "—"}</dd></div></dl>
            <div className="actions">
              <button disabled={working} onClick={() => void tick(1)}>تشغيل سنة</button>
              <button disabled={working} onClick={() => void tick(10)}>تشغيل عشر سنوات</button>
              <button disabled title="لم يُفعّل rollback بعد">Rollback (غير مفعّل)</button>
            </div>
          </article>
          <article>
            <h2>سلامة التشغيل</h2>
            <ul>
              <li><i /> قاعدة البيانات متصلة</li>
              <li><i /> سجل الأحداث يعمل</li>
              <li><i /> المخرجات الحتمية مفعّلة</li>
              <li><i /> بث Delta فوري</li>
            </ul>
          </article>
        </div>
        {error && <output className="error">{error}</output>}
      </section>
    </main>
  );
}
