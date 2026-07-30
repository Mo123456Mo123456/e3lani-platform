import { useCallback, useEffect, useState } from "react";
import { Badge, Button, DataTable, Panel } from "@planet/ui";
import { adminApi, getToken, setToken, type AdminUser, type SimulationStatus } from "./api";
import type { Role } from "@planet/shared-types";

type Tab = "simulation" | "users" | "moderation" | "ai" | "audit";

const ROLE_OPTIONS: Role[] = ["moderator", "simulation_admin", "admin", "super_admin"];

export function App() {
  const [authed, setAuthed] = useState<boolean>(getToken() !== null);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Console onLogout={() => { setToken(null); setAuthed(false); }} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("admin@planet.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.login(email, password);
      const rank = Math.max(...res.user.roles.map((r) => ["moderator", "simulation_admin", "admin", "super_admin"].indexOf(r)));
      if (rank < 0) throw new Error("not an admin account");
      setToken(res.tokens.accessToken);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <Panel title="لوحة الإدارة — كوكب يولد أمامك">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
            <input dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
            {error && <p className="error">{error}</p>}
            <Button type="submit" disabled={busy}>دخول</Button>
            <p className="hint">حسابات Sandbox موثقة في README (admin@planet.local)</p>
          </div>
        </Panel>
      </form>
    </div>
  );
}

function Console({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("simulation");
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <h1>◉ إدارة الكوكب</h1>
        <small>لوحة محمية — غير ظاهرة للمستخدمين</small>
        {([
          ["simulation", "المحاكاة"],
          ["users", "المستخدمون"],
          ["moderation", "الإشراف"],
          ["ai", "استهلاك الذكاء"],
          ["audit", "سجل العمليات"],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button key={key} className={`side-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="side-btn" onClick={onLogout}>خروج</button>
      </aside>
      <main className="admin-main">
        {tab === "simulation" && <SimulationTab />}
        {tab === "users" && <UsersTab />}
        {tab === "moderation" && <ModerationTab />}
        {tab === "ai" && <AiTab />}
        {tab === "audit" && <AuditTab />}
      </main>
    </div>
  );
}

function SimulationTab() {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [ticks, setTicks] = useState(10);
  const [rollbackTick, setRollbackTick] = useState(0);
  const [snapshots, setSnapshots] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminApi.simulation().then(setStatus).catch((e) => setMessage(String(e)));
  }, []);
  useEffect(refresh, [refresh]);

  const planet = status?.planets[0];
  useEffect(() => {
    if (planet) {
      adminApi.snapshots(planet.id).then(setSnapshots).catch(() => setSnapshots([]));
    }
  }, [planet]);

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage(`${label} ✓`);
      refresh();
    } catch (e) {
      setMessage(`${label}: ${e instanceof Error ? e.message : "failed"}`);
    }
  };

  if (!planet) return <p>جارٍ التحميل… {message}</p>;

  return (
    <div className="admin-grid">
      <Panel title={`${planet.name} — السنة ${planet.year}`}>
        <div className="kpi-row">
          <div className="kpi"><b>{planet.tick}</b><span>نبضة</span></div>
          <div className="kpi"><b>{planet.stats.civilizationCount}</b><span>حضارة</span></div>
          <div className="kpi"><b>{planet.stats.cityCount}</b><span>مدينة</span></div>
          <div className="kpi"><b>{planet.stats.eventCount}</b><span>حدث</span></div>
        </div>
        <p>
          الحالة: <Badge tone={planet.autoTicking ? "green" : "gold"}>{planet.autoTicking ? "تعمل تلقائيًا" : "متوقفة"}</Badge>{" "}
          <Badge tone="red">حروب نشطة: {planet.stats.activeWarCount}</Badge>
        </p>
        <div className="tick-controls" style={{ marginTop: 14 }}>
          <input type="number" min={1} max={5000} value={ticks} onChange={(e) => setTicks(Number(e.target.value))} />
          <Button onClick={() => act(() => adminApi.advance(planet.id, ticks), `تقديم ${ticks} نبضة`)}>تقديم نبضات</Button>
          {planet.autoTicking ? (
            <Button variant="ghost" onClick={() => act(() => adminApi.pause(planet.id), "إيقاف")}>إيقاف الزمن</Button>
          ) : (
            <Button variant="ghost" onClick={() => act(() => adminApi.resume(planet.id), "تشغيل")}>تشغيل الزمن</Button>
          )}
        </div>
        {message && <p className="hint">{message}</p>}
      </Panel>

      <Panel title="Rollback إلى لقطة">
        <div className="tick-controls">
          <input type="number" min={0} value={rollbackTick} onChange={(e) => setRollbackTick(Number(e.target.value))} />
          <Button variant="danger" onClick={() => act(() => adminApi.rollback(planet.id, rollbackTick), `Rollback إلى ${rollbackTick}`)}>
            تنفيذ Rollback
          </Button>
        </div>
        <p className="hint">
          اللقطات المتاحة: {snapshots.length > 0 ? snapshots.join("، ") : "—"}.
          إعادة التشغيل حتمية: نفس الأحداث تتكرر بالضبط حتى لحظة الهدف.
        </p>
      </Panel>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(() => {
    adminApi.users().then((res) => setUsers(res.users)).catch((e) => setMessage(String(e)));
  }, []);
  useEffect(refresh, [refresh]);

  const toggleRole = async (user: AdminUser, role: Role) => {
    const has = user.roles.includes(role);
    const next = has ? user.roles.filter((r) => r !== role) : [...user.roles, role];
    if (next.length === 0) next.push("user");
    try {
      await adminApi.assignRoles(user.id, next);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "forbidden (needs super_admin)");
    }
  };

  return (
    <Panel title={`المستخدمون (${users.length})`}>
      {message && <p className="error">{message}</p>}
      <DataTable<AdminUser>
        rows={users}
        empty="لا مستخدمين"
        columns={[
          { key: "email", header: "البريد", render: (u) => u.email },
          { key: "name", header: "الاسم", render: (u) => u.displayName },
          {
            key: "roles",
            header: "الأدوار (انقر للتبديل — super_admin فقط)",
            render: (u) => (
              <>
                {u.roles.map((r) => <Badge key={r} tone="cyan">{r}</Badge>)}{" "}
                {ROLE_OPTIONS.filter((r) => !u.roles.includes(r)).map((r) => (
                  <Button key={r} variant="ghost" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => void toggleRole(u, r)}>+{r}</Button>
                ))}
              </>
            ),
          },
        ]}
      />
    </Panel>
  );
}

function ModerationTab() {
  const [queue, setQueue] = useState<Array<{ id: string; targetId: string; verdict: string; reasons: string[]; createdAt: string }>>([]);
  useEffect(() => {
    adminApi.moderation().then((res) => setQueue(res.queue)).catch(() => undefined);
  }, []);
  return (
    <Panel title={`طابور الإشراف (${queue.length})`}>
      <DataTable
        rows={queue}
        empty="الطابور نظيف"
        columns={[
          { key: "verdict", header: "الحكم", render: (m) => <Badge tone={m.verdict === "block" ? "red" : "gold"}>{m.verdict}</Badge> },
          { key: "reasons", header: "الأسباب", render: (m) => m.reasons.join("، ") },
          { key: "at", header: "الوقت", render: (m) => new Date(m.createdAt).toLocaleString() },
        ]}
      />
    </Panel>
  );
}

function AiTab() {
  const [data, setData] = useState<{ logs: Array<{ id: string; provider: string; kind: string; costUsd: number; latencyMs: number; success: boolean; createdAt: string }>; totalCostUsd: number; failures: number; sandbox: boolean } | null>(null);
  useEffect(() => {
    adminApi.aiUsage().then(setData).catch(() => undefined);
  }, []);
  if (!data) return <p>جارٍ التحميل…</p>;
  return (
    <>
      <div className="kpi-row">
        <div className="kpi"><b>${data.totalCostUsd.toFixed(6)}</b><span>التكلفة الكلية</span></div>
        <div className="kpi"><b>{data.logs.length}</b><span>طلبات</span></div>
        <div className="kpi"><b>{data.failures}</b><span>إخفاقات</span></div>
        <div className="kpi"><b>{data.sandbox ? "Sandbox" : "Live"}</b><span>الوضع</span></div>
      </div>
      <Panel title="سجل طلبات الذكاء الاصطناعي">
        <DataTable
          rows={data.logs}
          empty="لا طلبات بعد"
          columns={[
            { key: "provider", header: "المزود", render: (l) => <Badge tone={l.provider === "mock" ? "gold" : "green"}>{l.provider}</Badge> },
            { key: "kind", header: "النوع", render: (l) => l.kind },
            { key: "cost", header: "التكلفة", render: (l) => `$${l.costUsd.toFixed(6)}` },
            { key: "latency", header: "الزمن", render: (l) => `${Math.round(l.latencyMs)}ms` },
            { key: "ok", header: "النجاح", render: (l) => (l.success ? "✓" : "✗") },
          ]}
        />
      </Panel>
    </>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<Array<{ id: string; actorId: string; action: string; detail: Record<string, unknown>; createdAt: string }>>([]);
  useEffect(() => {
    adminApi.audit().then((res) => setEntries(res.entries)).catch(() => undefined);
  }, []);
  return (
    <Panel title={`سجل العمليات (${entries.length})`}>
      <DataTable
        rows={entries}
        empty="لا عمليات"
        columns={[
          { key: "action", header: "العملية", render: (e) => e.action },
          { key: "actor", header: "الفاعل", render: (e) => e.actorId.slice(0, 8) },
          { key: "detail", header: "التفاصيل", render: (e) => JSON.stringify(e.detail).slice(0, 80) },
          { key: "at", header: "الوقت", render: (e) => new Date(e.createdAt).toLocaleString() },
        ]}
      />
    </Panel>
  );
}
