"use client";

import { useState, type FormEvent } from "react";
import {
  Activity,
  Bot,
  Database,
  Gauge,
  History,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PLANET_ID = "00000000-0000-4000-8000-000000000001";

interface Overview {
  users: string;
  contributions: string;
  events: string;
  moderation_queue: string;
  ai_cost_usd: string;
  avg_tick_ms: string;
}

export default function AdminPage() {
  const [email, setEmail] = useState("admin@planet.local");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [rollbackTick, setRollbackTick] = useState("120");

  const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? body.error ?? "Request failed");
    return body as T;
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Login failed");
      if (!body.user.roles.includes("super_admin") && !body.user.roles.includes("admin")) {
        throw new Error("هذا الحساب لا يملك صلاحيات الإدارة");
      }
      setToken(body.accessToken);
      const overviewResponse = await fetch(`${API_URL}/v1/admin/overview`, {
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      if (!overviewResponse.ok) throw new Error("تعذر تحميل مؤشرات الإدارة");
      setOverview(await overviewResponse.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل الدخول");
    } finally {
      setBusy(false);
    }
  };

  const runTick = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ tick: number; eventCount: number }>(`/v1/admin/planets/${PLANET_ID}/tick`, { method: "POST" });
      setMessage(`تم تثبيت Tick ${result.tick} وتسجيل ${result.eventCount} حدثًا.`);
      setOverview(await request<Overview>("/v1/admin/overview"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل تشغيل المحاكاة");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!window.confirm(`سيُحذف فرع الأحداث بعد Tick ${rollbackTick}. هل تريد المتابعة؟`)) return;
    setBusy(true);
    setMessage("");
    try {
      await request(`/v1/admin/planets/${PLANET_ID}/rollback/${Number(rollbackTick)}`, { method: "POST" });
      setMessage(`تمت العودة إلى Snapshot ${rollbackTick} وأوقفت المحاكاة.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل الرجوع");
    } finally {
      setBusy(false);
    }
  };

  if (!token || !overview) {
    return (
      <main className="admin-login">
        <form onSubmit={login}>
          <div className="lock"><LockKeyhole /></div>
          <p>منطقة محمية</p>
          <h1>إدارة الكوكب</h1>
          <span>يتحقق الخادم من RBAC لكل عملية، وليس إخفاء الواجهة فقط.</span>
          <label>البريد<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>كلمة المرور<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {message && <em>{message}</em>}
          <button disabled={busy}>{busy ? "جارٍ التحقق…" : "دخول آمن"}</button>
        </form>
      </main>
    );
  }

  const cards = [
    ["المستخدمون", overview.users, Users],
    ["المساهمات", overview.contributions, ShieldCheck],
    ["أحداث العالم", overview.events, History],
    ["قائمة المراجعة", overview.moderation_queue, Activity],
    ["تكلفة AI", `$${Number(overview.ai_cost_usd).toFixed(4)}`, Bot],
    ["متوسط Tick", `${Math.round(Number(overview.avg_tick_ms))}ms`, Gauge],
  ] as const;

  return (
    <main className="admin-shell">
      <aside>
        <h2>كوكب يولد أمامك</h2><small>Simulation Control</small>
        <nav>
          <a className="active"><Gauge /> النظرة العامة</a>
          <a><Users /> المستخدمون <i>قريبًا</i></a>
          <a><ShieldCheck /> الإشراف <i>قريبًا</i></a>
          <a><Database /> Snapshots</a>
          <a><Bot /> استهلاك الذكاء</a>
        </nav>
      </aside>
      <section>
        <header><div><p>لوحة العمليات</p><h1>حالة العالم والمحاكاة</h1></div><span><i /> متصل بقاعدة البيانات</span></header>
        <div className="metric-grid">
          {cards.map(([label, value, Icon]) => <article key={label}><Icon /><span>{label}</span><b>{value}</b></article>)}
        </div>
        <div className="admin-columns">
          <article className="control-card">
            <h3><Play /> التحكم بالمحاكاة</h3>
            <p>يشغّل Tick حتميًا، يحفظ أحداثه وتغيرات المناطق داخل معاملة واحدة، ثم يرسل Delta للمشتركين.</p>
            <button onClick={runTick} disabled={busy}><Play /> تشغيل Tick واحد</button>
          </article>
          <article className="control-card danger">
            <h3><RotateCcw /> Rollback إلى Snapshot</h3>
            <p>عملية مدمرة للفرع المستقبلي. تُسجّل في Audit Log وتتطلب صلاحية مدير المحاكاة.</p>
            <div><input type="number" min="0" value={rollbackTick} onChange={(event) => setRollbackTick(event.target.value)} /><button onClick={rollback} disabled={busy}><RotateCcw /> تنفيذ</button></div>
          </article>
        </div>
        {message && <div className="admin-message">{message}</div>}
        <section className="disabled-modules">
          <h3>وحدات مرئية وغير مفعّلة بعد</h3>
          <p>مراقبة NATS، استعراض traces، وإدارة ملفات S3 ستظهر هنا بعد ربط بواباتها؛ لا تعرض اللوحة بيانات مصطنعة لها.</p>
        </section>
      </section>
    </main>
  );
}
