"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  getCurrentUser,
  getHealth,
  getTimeline,
  getWorldSummary,
  rollbackTimeline,
  setSimulationPaused,
  signIn,
  signOut,
  type HealthStatus,
  type PlanetSummary,
  type TimelineSnapshot,
  type UserIdentity,
} from "../lib/api";
import {
  formatDateTime,
  formatInteger,
  formatNumber,
  formatPercent,
  humanizeReason,
} from "../lib/format";

type AuthState =
  | { phase: "checking" }
  | { phase: "signed-out" }
  | { phase: "denied"; user: UserIdentity }
  | { phase: "error"; error: ApiError }
  | { phase: "admin"; user: UserIdentity };

type DashboardData = {
  health: HealthStatus;
  summary: PlanetSummary;
  snapshots: TimelineSnapshot[];
  loadedAt: string;
};

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError("حدث خطأ غير متوقع.", 0, "UNKNOWN_ERROR");
}

function errorText(error: ApiError): string {
  if (error.status === 401) return "انتهت الجلسة. سجّل الدخول مرة أخرى.";
  if (error.status === 403) return "لا تملك صلاحية تنفيذ هذا الإجراء.";
  if (error.code === "API_NOT_CONFIGURED") return "عنوان API غير مضبوط لهذا التطبيق.";
  if (error.code === "NETWORK_ERROR") return "تعذر الوصول إلى خدمة الكوكب.";
  return error.message;
}

export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ phase: "checking" });

  const verifyAccess = useCallback(async () => {
    setAuth({ phase: "checking" });
    try {
      const user = await getCurrentUser();
      setAuth(
        user.roles.some((role) =>
          ["simulation_manager", "admin", "system_admin", "super_admin"].includes(role),
        )
          ? { phase: "admin", user }
          : { phase: "denied", user },
      );
    } catch (error) {
      const apiError = asApiError(error);
      setAuth(
        apiError.status === 401
          ? { phase: "signed-out" }
          : { phase: "error", error: apiError },
      );
    }
  }, []);

  useEffect(() => {
    void verifyAccess();
  }, [verifyAccess]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // The local view still closes even if an already-expired session cannot be revoked.
    }
    setAuth({ phase: "signed-out" });
  }, []);

  if (auth.phase === "checking") return <FullScreenLoader />;
  if (auth.phase === "signed-out") return <LoginPanel onAuthenticated={verifyAccess} />;
  if (auth.phase === "denied") {
    return <AccessDenied user={auth.user} onSignOut={handleSignOut} />;
  }
  if (auth.phase === "error") {
    return (
      <AccessCheckError
        error={auth.error}
        onRetry={verifyAccess}
        onReturnToLogin={() => setAuth({ phase: "signed-out" })}
      />
    );
  }

  return (
    <Dashboard
      user={auth.user}
      onSignOut={handleSignOut}
      onSessionLost={() => setAuth({ phase: "signed-out" })}
      onAccessDenied={() => setAuth({ phase: "denied", user: auth.user })}
    />
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>كوكب</strong>
        <small>KAWKAB CONTROL</small>
      </span>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <main className="center-shell" aria-busy="true" aria-live="polite">
      <div className="loader-card">
        <Brand />
        <span className="spinner" aria-hidden="true" />
        <h1>جارٍ التحقق من الجلسة</h1>
        <p>Verifying protected admin access…</p>
      </div>
    </main>
  );
}

function LoginPanel({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      await onAuthenticated();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-aside" aria-label="هوية التطبيق">
        <Brand />
        <div className="orbit-visual" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="planet" />
        </div>
        <div className="login-intro">
          <span className="eyebrow">مساحة تشغيل مستقلة · RESTRICTED</span>
          <h1>راقب نبض العالم.<br />وتدخّل بحذر.</h1>
          <p>
            مركز العمليات المحمي لمنظومة «كوكب يولد أمامك». لا يتم عرض أي بيانات
            قبل إثبات دور المدير.
          </p>
        </div>
        <div className="security-note">
          <span className="pulse-dot" aria-hidden="true" />
          جلسة آمنة عبر HttpOnly cookie
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="mobile-brand"><Brand /></div>
          <span className="eyebrow">ADMIN CONSOLE</span>
          <h2>تسجيل دخول الإدارة</h2>
          <p className="form-lead">أدخل بيانات حساب يملك دور <bdi>admin</bdi>.</p>

          {error ? (
            <div className="alert alert-error" role="alert">
              <strong>تعذّر تسجيل الدخول</strong>
              <span>{errorText(error)}</span>
              {error.requestId ? <small>Request ID: {error.requestId}</small> : null}
            </div>
          ) : null}

          <label className="field">
            <span>البريد الإلكتروني <small>Email</small></span>
            <input
              type="email"
              name="email"
              dir="ltr"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
              disabled={submitting}
            />
          </label>

          <label className="field">
            <span>كلمة المرور <small>Password</small></span>
            <input
              type="password"
              name="password"
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <button className="button button-primary button-wide" type="submit" disabled={submitting}>
            {submitting ? <span className="button-spinner" aria-hidden="true" /> : null}
            {submitting ? "جارٍ التحقق…" : "دخول مركز التحكم"}
          </button>
          <p className="form-footnote">
            بعد الدخول، يعيد النظام التحقق من الهوية والصلاحية عبر <bdi>GET /auth/me</bdi>.
          </p>
        </form>
      </section>
    </main>
  );
}

function AccessDenied({
  user,
  onSignOut,
}: {
  user: UserIdentity;
  onSignOut: () => void;
}) {
  return (
    <main className="center-shell">
      <section className="message-card">
        <span className="message-icon denied" aria-hidden="true">!</span>
        <span className="eyebrow">ACCESS DENIED · 403</span>
        <h1>صلاحية المدير مطلوبة</h1>
        <p>
          الحساب <bdi>{user.email}</bdi> موثّق، لكنه لا يملك دور <bdi>admin</bdi>.
          لم يتم تحميل بيانات لوحة التحكم.
        </p>
        <button className="button button-secondary" type="button" onClick={onSignOut}>
          تسجيل الخروج
        </button>
      </section>
    </main>
  );
}

function AccessCheckError({
  error,
  onRetry,
  onReturnToLogin,
}: {
  error: ApiError;
  onRetry: () => void;
  onReturnToLogin: () => void;
}) {
  return (
    <main className="center-shell">
      <section className="message-card">
        <span className="message-icon warning" aria-hidden="true">!</span>
        <span className="eyebrow">AUTHORIZATION CHECK FAILED</span>
        <h1>تعذّر التحقق من الوصول</h1>
        <p>{errorText(error)}</p>
        {error.status === 404 ? (
          <div className="alert alert-warning">
            يتطلب هذا التطبيق عقد <bdi>GET /auth/me</bdi>، لكن المسار غير متاح في API الحالي.
          </div>
        ) : null}
        {error.requestId ? <code className="request-id">Request ID: {error.requestId}</code> : null}
        <div className="button-row">
          <button className="button button-primary" type="button" onClick={onRetry}>
            إعادة المحاولة
          </button>
          <button className="button button-ghost" type="button" onClick={onReturnToLogin}>
            العودة للدخول
          </button>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  user,
  onSignOut,
  onSessionLost,
  onAccessDenied,
}: {
  user: UserIdentity;
  onSignOut: () => void;
  onSessionLost: () => void;
  onAccessDenied: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [action, setAction] = useState<"pause" | "resume" | "rollback" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTick, setSelectedTick] = useState("");
  const [confirmingRollback, setConfirmingRollback] = useState(false);

  const loadDashboard = useCallback(
    async (initial = false) => {
      initial ? setLoading(true) : setRefreshing(true);
      setError(null);
      try {
        const [health, summary] = await Promise.all([getHealth(), getWorldSummary()]);
        const timeline = await getTimeline(summary.id);
        setData({
          health,
          summary,
          snapshots: timeline.items,
          loadedAt: new Date().toISOString(),
        });
      } catch (caught) {
        const apiError = asApiError(caught);
        if (apiError.status === 401) onSessionLost();
        else if (apiError.status === 403) onAccessDenied();
        else setError(apiError);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onAccessDenied, onSessionLost],
  );

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  async function changeSimulation(paused: boolean) {
    if (!data) return;
    setAction(paused ? "pause" : "resume");
    setError(null);
    setNotice(null);
    try {
      await setSimulationPaused(data.summary.id, paused);
      setNotice(paused ? "تم إيقاف نبضات المحاكاة." : "تم استئناف نبضات المحاكاة.");
      await loadDashboard();
    } catch (caught) {
      const apiError = asApiError(caught);
      if (apiError.status === 401) onSessionLost();
      else if (apiError.status === 403) onAccessDenied();
      else setError(apiError);
    } finally {
      setAction(null);
    }
  }

  async function confirmRollback() {
    if (!data || selectedTick === "") return;
    setAction("rollback");
    setError(null);
    setNotice(null);
    try {
      await rollbackTimeline(data.summary.id, Number(selectedTick));
      setConfirmingRollback(false);
      setSelectedTick("");
      setNotice(`تمت استعادة اللقطة عند النبضة ${selectedTick} وإيقاف المحاكاة.`);
      await loadDashboard();
    } catch (caught) {
      const apiError = asApiError(caught);
      if (apiError.status === 401) onSessionLost();
      else if (apiError.status === 403) onAccessDenied();
      else setError(apiError);
    } finally {
      setAction(null);
    }
  }

  const selectedSnapshot = useMemo(
    () => data?.snapshots.find((snapshot) => String(snapshot.tick) === selectedTick),
    [data?.snapshots, selectedTick],
  );

  return (
    <div className="admin-shell">
      <Sidebar user={user} onSignOut={onSignOut} />
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">مركز العمليات · OPERATIONS</span>
            <h1>لوحة قيادة العالم</h1>
          </div>
          <div className="topbar-actions">
            {data ? (
              <span className="last-update">
                آخر تحديث
                <bdi>{formatDateTime(data.loadedAt)}</bdi>
              </span>
            ) : null}
            <button
              className="icon-button"
              type="button"
              aria-label="تحديث بيانات لوحة القيادة"
              title="تحديث"
              disabled={refreshing}
              onClick={() => void loadDashboard()}
            >
              <span className={refreshing ? "rotating" : ""} aria-hidden="true">↻</span>
            </button>
            <div className="mobile-user">
              <span>{user.displayName.slice(0, 1)}</span>
              <button type="button" onClick={onSignOut}>خروج</button>
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="sr-status" aria-live="polite">
            {loading ? "جارٍ تحميل لوحة التحكم" : refreshing ? "جارٍ تحديث البيانات" : notice}
          </div>

          {notice ? (
            <div className="alert alert-success dismissible" role="status">
              <span>{notice}</span>
              <button type="button" aria-label="إغلاق التنبيه" onClick={() => setNotice(null)}>×</button>
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-error dashboard-alert" role="alert">
              <span><strong>تعذر إكمال الطلب.</strong> {errorText(error)}</span>
              {error.requestId ? <small>Request ID: {error.requestId}</small> : null}
              <button type="button" onClick={() => setError(null)} aria-label="إغلاق الخطأ">×</button>
            </div>
          ) : null}

          {loading && !data ? <DashboardSkeleton /> : null}
          {!loading && !data ? (
            <section className="empty-state">
              <h2>لا يمكن تحميل لوحة القيادة</h2>
              <p>لم يتم إدراج بيانات بديلة. تحقّق من API ثم أعد المحاولة.</p>
              <button className="button button-primary" type="button" onClick={() => void loadDashboard(true)}>
                إعادة المحاولة
              </button>
            </section>
          ) : null}

          {data ? (
            <>
              <section id="overview" className="section-block" aria-labelledby="overview-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">LIVE SYSTEMS</span>
                    <h2 id="overview-title">حالة المنظومة</h2>
                  </div>
                  <span className={`overall-badge ${data.health.status === "ok" ? "healthy" : "degraded"}`}>
                    <span className="pulse-dot" aria-hidden="true" />
                    {data.health.status === "ok" ? "الأنظمة المُبلغ عنها سليمة" : "المنظومة متدهورة"}
                  </span>
                </div>
                <HealthGrid health={data.health} />
              </section>

              <section className="section-block" aria-labelledby="world-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">WORLD SNAPSHOT</span>
                    <h2 id="world-title">{data.summary.name}</h2>
                  </div>
                  <div className={`simulation-chip ${data.summary.isPaused ? "paused" : "running"}`}>
                    <span aria-hidden="true">{data.summary.isPaused ? "Ⅱ" : "▶"}</span>
                    <span>
                      {data.summary.isPaused ? "المحاكاة متوقفة" : "المحاكاة تعمل"}
                      <small>نبضة {formatInteger(data.summary.currentTick)}</small>
                    </span>
                  </div>
                </div>
                <WorldMetrics summary={data.summary} />
                <WorldCounters summary={data.summary} />
              </section>

              <section id="controls" className="section-block" aria-labelledby="controls-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">GUARDED ACTIONS</span>
                    <h2 id="controls-title">التحكم بالمحاكاة</h2>
                  </div>
                  <span className="admin-only">ADMIN ONLY</span>
                </div>
                <div className="control-grid">
                  <article className="panel control-panel">
                    <div className="panel-icon cyan" aria-hidden="true">⏱</div>
                    <div className="panel-copy">
                      <h3>نبضات المحاكاة</h3>
                      <p>أوقف استقبال النبضات أو استأنفها دون تعديل الخط الزمني.</p>
                    </div>
                    <div className="button-row">
                      <button
                        className="button button-danger"
                        type="button"
                        disabled={data.summary.isPaused || action !== null}
                        onClick={() => void changeSimulation(true)}
                      >
                        {action === "pause" ? <span className="button-spinner" /> : null}
                        إيقاف النبضات
                      </button>
                      <button
                        className="button button-success"
                        type="button"
                        disabled={!data.summary.isPaused || action !== null}
                        onClick={() => void changeSimulation(false)}
                      >
                        {action === "resume" ? <span className="button-spinner" /> : null}
                        استئناف
                      </button>
                    </div>
                  </article>

                  <article className="panel control-panel rollback-panel">
                    <div className="panel-icon amber" aria-hidden="true">↶</div>
                    <div className="panel-copy">
                      <h3>استعادة لقطة زمنية</h3>
                      <p>يعيد حالة العالم إلى لقطة محفوظة، ويلغي الآثار اللاحقة ويوقف المحاكاة.</p>
                    </div>
                    <label className="select-field">
                      <span>اختر لقطة</span>
                      <select
                        value={selectedTick}
                        onChange={(event) => setSelectedTick(event.target.value)}
                        disabled={action !== null || data.snapshots.length === 0}
                      >
                        <option value="">— اختر نبضة للاستعادة —</option>
                        {data.snapshots.map((snapshot) => (
                          <option key={snapshot.id} value={snapshot.tick}>
                            نبضة {snapshot.tick} · {humanizeReason(snapshot.reason)} · {formatDateTime(snapshot.createdAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button button-warning"
                      type="button"
                      disabled={!selectedSnapshot || action !== null}
                      onClick={() => setConfirmingRollback(true)}
                    >
                      مراجعة الاستعادة
                    </button>
                  </article>
                </div>
              </section>

              <section id="timeline" className="section-block" aria-labelledby="timeline-title">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">RECENT CHECKPOINTS</span>
                    <h2 id="timeline-title">لقطات الخط الزمني</h2>
                  </div>
                  <span className="record-count">{formatInteger(data.snapshots.length)} لقطة محمّلة</span>
                </div>
                <TimelineTable snapshots={data.snapshots} currentTick={data.summary.currentTick} />
              </section>

              <DisabledMonitoring />
            </>
          ) : null}
        </main>
      </div>

      {confirmingRollback && selectedSnapshot && data ? (
        <RollbackDialog
          snapshot={selectedSnapshot}
          currentTick={data.summary.currentTick}
          busy={action === "rollback"}
          onCancel={() => setConfirmingRollback(false)}
          onConfirm={() => void confirmRollback()}
        />
      ) : null}
    </div>
  );
}

function Sidebar({ user, onSignOut }: { user: UserIdentity; onSignOut: () => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="أقسام لوحة الإدارة">
        <span className="nav-label">التشغيل</span>
        <a className="nav-item active" href="#overview"><span aria-hidden="true">◫</span> نظرة عامة</a>
        <a className="nav-item" href="#controls"><span aria-hidden="true">⌁</span> التحكم بالمحاكاة</a>
        <a className="nav-item" href="#timeline"><span aria-hidden="true">◴</span> الخط الزمني</a>
        <span className="nav-label">المراقبة العميقة</span>
        <span className="nav-item disabled" aria-disabled="true"><span aria-hidden="true">◇</span> تتبّع الذكاء <small>غير منفّذ</small></span>
        <span className="nav-item disabled" aria-disabled="true"><span aria-hidden="true">≋</span> مستكشف الطوابير <small>غير منفّذ</small></span>
        <span className="nav-item disabled" aria-disabled="true"><span aria-hidden="true">▱</span> سجلات التدقيق <small>غير منفّذ</small></span>
      </nav>
      <div className="sidebar-user">
        <span className="avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</span>
        <span className="user-copy">
          <strong>{user.displayName}</strong>
          <small dir="ltr">{user.email}</small>
        </span>
        <button type="button" onClick={onSignOut} aria-label="تسجيل الخروج" title="تسجيل الخروج">↪</button>
      </div>
    </aside>
  );
}

function HealthGrid({ health }: { health: HealthStatus }) {
  const apiHealthy = health.status === "ok";
  const persistenceHealthy = health.persistence.ok !== false;
  const aiConfigured = health.ai.configured !== false;
  return (
    <div className="health-grid">
      <HealthCard
        label="API"
        title="خدمة التطبيق"
        state={apiHealthy ? "healthy" : "danger"}
        status={apiHealthy ? "تستجيب" : "متدهورة"}
        detail={health.sandboxMode ? "وضع Sandbox صريح" : "وضع الإنتاج"}
      />
      <HealthCard
        label="PERSISTENCE"
        title="طبقة الحفظ"
        state={persistenceHealthy ? "healthy" : "danger"}
        status={persistenceHealthy ? "متاحة" : "خطأ"}
        detail={`${health.persistence.kind}${health.persistence.latencyMs !== undefined ? ` · ${formatNumber(health.persistence.latencyMs)} ms` : ""}`}
      />
      <HealthCard
        label="AI PROVIDER"
        title={health.ai.provider}
        state={aiConfigured ? "neutral" : "warning"}
        status={aiConfigured ? "مُهيّأ" : "غير مُهيّأ"}
        detail={
          health.ai.connectivity === "not_checked"
            ? "الاتصال بالمزوّد لم يُفحص"
            : `الاتصال: ${health.ai.connectivity ?? "غير مُبلغ"}`
        }
      />
      <HealthCard
        label="EVENT BUS / QUEUE"
        title="ناقل الأحداث"
        state="neutral"
        status={health.eventBus.kind}
        detail="عمق الطابور ومعدل الرسائل غير مُتاحين"
      />
    </div>
  );
}

function HealthCard({
  label,
  title,
  state,
  status,
  detail,
}: {
  label: string;
  title: string;
  state: "healthy" | "warning" | "danger" | "neutral";
  status: string;
  detail: string;
}) {
  return (
    <article className={`health-card ${state}`}>
      <div className="health-card-top">
        <span className="health-label">{label}</span>
        <span className="health-light" aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <strong>{status}</strong>
      <p>{detail}</p>
    </article>
  );
}

function WorldMetrics({ summary }: { summary: PlanetSummary }) {
  const metrics = [
    { label: "الاستقرار", en: "Stability", value: formatPercent(summary.stability), fill: summary.stability },
    { label: "التنوع الحيوي", en: "Biodiversity", value: formatPercent(summary.biodiversity), fill: summary.biodiversity },
    { label: "متوسط الحرارة", en: "Temperature", value: `${formatNumber(summary.averageTemperature)}°م`, fill: null },
    { label: "السكان", en: "Population", value: formatInteger(summary.population), fill: null },
  ];
  return (
    <div className="metrics-grid">
      {metrics.map((metric) => (
        <article className="metric-card" key={metric.en}>
          <span>{metric.label}<small>{metric.en}</small></span>
          <strong>{metric.value}</strong>
          {metric.fill !== null ? (
            <span className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, metric.fill * 100))}%` }} /></span>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function WorldCounters({ summary }: { summary: PlanetSummary }) {
  const counters = [
    ["الأقاليم", summary.counts.regions],
    ["الحضارات", summary.counts.civilizations],
    ["المدن", summary.counts.cities],
    ["الموارد", summary.counts.resources],
    ["الأنواع", summary.counts.species],
    ["النباتات", summary.counts.plants],
    ["التقنيات", summary.counts.technologies],
  ] as const;
  return (
    <div className="counter-strip" aria-label="عدادات العالم">
      {counters.map(([label, value]) => (
        <span key={label}><strong>{formatInteger(value)}</strong><small>{label}</small></span>
      ))}
    </div>
  );
}

function TimelineTable({
  snapshots,
  currentTick,
}: {
  snapshots: TimelineSnapshot[];
  currentTick: number;
}) {
  if (snapshots.length === 0) {
    return <div className="panel no-records">لا توجد لقطات زمنية متاحة من API.</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>النبضة</th>
            <th>السبب</th>
            <th>وقت الإنشاء</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => (
            <tr key={snapshot.id}>
              <td><bdi className="tick-number">#{formatInteger(snapshot.tick)}</bdi></td>
              <td>{humanizeReason(snapshot.reason)}</td>
              <td><bdi>{formatDateTime(snapshot.createdAt)}</bdi></td>
              <td>
                <span className={snapshot.tick === currentTick ? "row-status current" : "row-status"}>
                  {snapshot.tick === currentTick ? "الحالية" : "محفوظة"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DisabledMonitoring() {
  const items = [
    ["تتبّع استدعاءات الذكاء", "AI trace explorer", "السياق، زمن الاستجابة، والتكلفة لكل استدعاء."],
    ["قياسات الطابور", "Queue telemetry", "عمق الطابور، التأخير، ومعدلات إعادة المحاولة."],
    ["تحليل الاستمرارية", "Persistence insights", "الاستعلامات البطيئة، الأقفال، واستهلاك الاتصالات."],
  ];
  return (
    <section className="section-block disabled-section" aria-labelledby="disabled-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">NOT IMPLEMENTED</span>
          <h2 id="disabled-title">شاشات المراقبة العميقة</h2>
        </div>
        <span className="disabled-badge">معطّلة بوضوح</span>
      </div>
      <p className="section-description">
        لا توفّر عقود API الحالية بيانات هذه الشاشات؛ لذا لا تعرض اللوحة قيماً وهمية ولا تدّعي اكتمالها.
      </p>
      <div className="disabled-grid">
        {items.map(([title, english, description]) => (
          <article className="disabled-card" key={english} aria-disabled="true">
            <span className="lock" aria-hidden="true">×</span>
            <h3>{title}<small>{english}</small></h3>
            <p>{description}</p>
            <button type="button" disabled>غير منفّذ</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RollbackDialog({
  snapshot,
  currentTick,
  busy,
  onCancel,
  onConfirm,
}: {
  snapshot: TimelineSnapshot;
  currentTick: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rollback-title"
        aria-describedby="rollback-description"
      >
        <span className="message-icon warning" aria-hidden="true">↶</span>
        <span className="eyebrow">DESTRUCTIVE OPERATION</span>
        <h2 id="rollback-title">تأكيد استعادة الخط الزمني</h2>
        <p id="rollback-description">
          ستعود حالة العالم من النبضة <strong>{formatInteger(currentTick)}</strong> إلى النبضة{" "}
          <strong>{formatInteger(snapshot.tick)}</strong>. ستُسحب الأحداث اللاحقة وتتوقف المحاكاة.
        </p>
        <dl className="snapshot-details">
          <div><dt>السبب</dt><dd>{humanizeReason(snapshot.reason)}</dd></div>
          <div><dt>تاريخ اللقطة</dt><dd>{formatDateTime(snapshot.createdAt)}</dd></div>
          <div><dt>Snapshot ID</dt><dd dir="ltr">{snapshot.id}</dd></div>
        </dl>
        <div className="alert alert-warning">هذا الإجراء تشغيلي حقيقي ولا يستخدم بيانات تجريبية بديلة.</div>
        <div className="button-row">
          <button
            className="button button-danger"
            type="button"
            autoFocus
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <span className="button-spinner" /> : null}
            {busy ? "جارٍ الاستعادة…" : "نعم، استعد هذه اللقطة"}
          </button>
          <button className="button button-ghost" type="button" disabled={busy} onClick={onCancel}>
            إلغاء
          </button>
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      <div className="skeleton-title" />
      <div className="skeleton-grid">
        <span /><span /><span /><span />
      </div>
      <div className="skeleton-panel" />
    </div>
  );
}
