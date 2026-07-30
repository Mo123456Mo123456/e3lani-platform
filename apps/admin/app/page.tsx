"use client";

import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Play,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

interface Session {
  accessToken: string;
  user: { id: string; email: string };
}

interface WorldStatus {
  id: string;
  nameAr: string;
  currentTick: number;
  currentYear: number;
  stateHash: string;
  persistenceMode: "postgresql" | "memory-sandbox";
  counts: Record<string, number>;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [world, setWorld] = useState<WorldStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWorld = async () => {
    const response = await fetch(`${apiUrl}/api/v1/worlds/current`);
    if (!response.ok) throw new Error("تعذر تحميل حالة المحاكاة");
    setWorld((await response.json()) as WorldStatus);
  };

  useEffect(() => {
    if (session) void loadWorld().catch((cause: Error) => setError(cause.message));
  }, [session]);

  if (!session) {
    return <AdminLogin onSession={setSession} />;
  }

  const advance = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/worlds/${world?.id}/ticks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ count: 10 }),
      });
      if (!response.ok) throw new Error("فشل تشغيل Ticks");
      await loadWorld();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل غير معروف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <aside>
        <div className="admin-brand">
          <Globe2 />
          <span>
            <b>مركز إدارة العالم</b>
            <small>Simulation Control</small>
          </span>
        </div>
        <nav>
          <a className="active" href="#">
            <Gauge /> نظرة عامة
          </a>
          <a href="#simulation">
            <Activity /> المحاكاة
          </a>
          <a href="#storage">
            <Database /> التخزين
          </a>
          <a href="#readiness">
            <ShieldCheck /> جاهزية الأنظمة
          </a>
        </nav>
        <div className="admin-user">
          <span>{session.user.email}</span>
          <button onClick={() => setSession(null)}>
            <LogOut /> خروج
          </button>
        </div>
      </aside>
      <section className="admin-content">
        <header>
          <div>
            <span>لوحة محمية بالمصادقة</span>
            <h1>حالة محرك العالم</h1>
          </div>
          <button className="advance" onClick={advance} disabled={busy || !world}>
            {busy ? <LoaderCircle className="spin" /> : <Play />}
            تشغيل 10 Ticks
          </button>
        </header>
        {error && (
          <div className="admin-error">
            <AlertTriangle /> {error}
          </div>
        )}
        <div className="metric-grid">
          <Metric
            icon={Activity}
            label="Tick الحالي"
            value={world?.currentTick.toLocaleString("ar") ?? "—"}
          />
          <Metric
            icon={Users}
            label="الحضارات"
            value={world?.counts.civilizations?.toLocaleString("ar") ?? "—"}
          />
          <Metric
            icon={Globe2}
            label="مناطق العالم"
            value={world?.counts.regions?.toLocaleString("ar") ?? "—"}
          />
          <Metric
            icon={Database}
            label="الأحداث"
            value={world?.counts.events?.toLocaleString("ar") ?? "—"}
          />
        </div>
        <div className="admin-grid">
          <article id="simulation">
            <header>
              <h2>سلامة المحاكاة</h2>
              <span className="healthy">تعمل</span>
            </header>
            <dl>
              <div>
                <dt>العالم</dt>
                <dd>{world?.nameAr ?? "—"}</dd>
              </div>
              <div>
                <dt>السنة</dt>
                <dd>{world?.currentYear.toLocaleString("ar") ?? "—"}</dd>
              </div>
              <div>
                <dt>State hash</dt>
                <dd className="hash">{world?.stateHash.slice(0, 20) ?? "—"}…</dd>
              </div>
            </dl>
          </article>
          <article id="storage">
            <header>
              <h2>نمط الاستمرارية</h2>
              <span
                className={
                  world?.persistenceMode === "postgresql"
                    ? "healthy"
                    : "warning"
                }
              >
                {world?.persistenceMode ?? "—"}
              </span>
            </header>
            <p>
              {world?.persistenceMode === "postgresql"
                ? "الأحداث والتغيرات محفوظة في PostgreSQL."
                : "هذا Sandbox غير دائم. لا يُسمح بهذا النمط في الإنتاج."}
            </p>
          </article>
          <article id="readiness" className="readiness">
            <header>
              <h2>نطاق لوحة المرحلة الأولى</h2>
              <ServerCog />
            </header>
            <ul>
              <li className="ready">المصادقة وتدوير Refresh Token</li>
              <li className="ready">قراءة حالة العالم وتشغيل Ticks</li>
              <li className="ready">توثيق العمليات في Event Store</li>
              <li>مراجعة المحتوى المتقدمة — غير مفعلة بعد</li>
              <li>Rollback مرئي — غير مفعل بعد</li>
              <li>مراقبة التكلفة — غير مفعلة بعد</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}

function AdminLogin({ onSession }: { onSession: (session: Session) => void }) {
  const [email, setEmail] = useState("admin@planet.local");
  const [password, setPassword] = useState("PlanetSandbox!2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as Session & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "فشل تسجيل الدخول");
      onSession(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-screen">
      <form onSubmit={submit}>
        <span className="login-icon">
          <LockKeyhole />
        </span>
        <h1>إدارة محاكاة الكوكب</h1>
        <p>هذه الواجهة غير مرتبطة بتنقل المستخدم العام.</p>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          كلمة المرور
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}
          دخول آمن
        </button>
        <small>بيانات Sandbox موثقة في README فقط.</small>
      </form>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <article className="metric">
      <Icon />
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </article>
  );
}
