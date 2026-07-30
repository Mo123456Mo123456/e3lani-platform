"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Globe2,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { WorldOverview } from "@living-planet/shared-types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AdminPage() {
  const [world, setWorld] = useState<WorldOverview>();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [rollbackTick, setRollbackTick] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch(`${apiUrl}/v1/world/overview`);
    if (!response.ok) throw new Error("WORLD_API_UNAVAILABLE");
    setWorld((await response.json()) as WorldOverview);
  }, []);

  useEffect(() => {
    void Promise.all([
      load(),
      fetch(`${apiUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "explorer@azura.world",
          password: "Azura!2347",
        }),
      })
        .then((response) => response.json())
        .then((session: { accessToken: string }) => setToken(session.accessToken)),
    ]).catch((caught) =>
      setError(caught instanceof Error ? caught.message : "STARTUP_FAILED"),
    );
  }, [load]);

  const command = async (path: string, body: object) => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "COMMAND_FAILED");
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "COMMAND_FAILED");
    } finally {
      setBusy(false);
    }
  };

  if (!world) {
    return (
      <main className="admin-loading">
        <LoaderCircle className="spin" />
        <p>{error ?? "الاتصال بمحرك أزورا…"}</p>
      </main>
    );
  }

  const stats = [
    [Users, "الحضارات", world.civilizations.length, "مستقرة"],
    [Activity, "أحداث نافذة العرض", world.events.length, "لحظي"],
    [Gauge, "إصدار العالم", world.planet.version, "Event sourced"],
    [Clock3, "دورة المحاكاة", world.planet.tick, `${world.planet.tickYears} سنة`],
    [Database, "المناطق", world.regions.length, "PostGIS-ready"],
    [Bot, "وضع الذكاء", world.sandbox ? "Sandbox" : "Provider", "Structured"],
  ] as const;

  return (
    <main className="admin-shell">
      <aside>
        <div className="admin-brand">
          <Globe2 />
          <div>
            <b>إدارة أزورا</b>
            <span>Simulation Control</span>
          </div>
        </div>
        <nav>
          <button className="active">
            <Gauge /> نظرة عامة
          </button>
          <button>
            <Users /> المستخدمون
          </button>
          <button>
            <Boxes /> المساهمات
          </button>
          <button>
            <Activity /> مراقبة المحاكاة
          </button>
          <button>
            <Bot /> استهلاك الذكاء
          </button>
          <button>
            <ShieldCheck /> سجل التدقيق
          </button>
          <button>
            <ServerCog /> البنية التحتية
          </button>
        </nav>
        <div className="admin-identity">
          <span>م</span>
          <div>
            <b>مستكشف أزورا</b>
            <small>SUPER ADMIN · SANDBOX</small>
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <header>
          <div>
            <span>لوحة مستقلة محمية بصلاحيات RBAC</span>
            <h1>مركز عمليات الكوكب</h1>
          </div>
          <div className="health-pill">
            <i />
            جميع الأنظمة تعمل
          </div>
        </header>

        {error && <div className="admin-error">{error}</div>}
        <div className="admin-stats">
          {stats.map(([Icon, label, value, detail]) => (
            <article key={label}>
              <span>
                <Icon />
              </span>
              <div>
                <small>{label}</small>
                <b>{value}</b>
                <em>{detail}</em>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-grid">
          <section className="control-card">
            <div className="card-title">
              <div>
                <span>WORLD TICK ENGINE</span>
                <h2>التحكم بالمحاكاة</h2>
              </div>
              <span className={world.planet.paused ? "paused" : "running"}>
                {world.planet.paused ? "متوقفة" : "تعمل"}
              </span>
            </div>
            <div className="engine-display">
              <div>
                <small>السنة</small>
                <strong>{world.planet.year.toLocaleString("ar")}</strong>
              </div>
              <div>
                <small>الدورة</small>
                <strong>#{world.planet.tick}</strong>
              </div>
              <div>
                <small>الحرارة</small>
                <strong>{world.climate.meanTemperature.toFixed(2)}°</strong>
              </div>
              <div>
                <small>البذرة</small>
                <strong className="seed">{world.planet.seed}</strong>
              </div>
            </div>
            <div className="control-actions">
              <button
                onClick={() => void command("/v1/simulation/tick", {})}
                disabled={busy || world.planet.paused}
              >
                <Play /> تشغيل دورة
              </button>
              <button
                onClick={() =>
                  void command("/v1/simulation/pause", {
                    paused: !world.planet.paused,
                  })
                }
                disabled={busy}
              >
                <Pause /> {world.planet.paused ? "استئناف" : "إيقاف"}
              </button>
            </div>
            <div className="rollback">
              <label>
                Rollback إلى Snapshot
                <input
                  type="number"
                  min={0}
                  max={world.planet.tick}
                  value={rollbackTick}
                  onChange={(event) => setRollbackTick(Number(event.target.value))}
                />
              </label>
              <button
                onClick={() =>
                  void command("/v1/simulation/rollback", { tick: rollbackTick })
                }
                disabled={busy}
              >
                <RotateCcw /> استعادة
              </button>
            </div>
          </section>

          <section className="events-card">
            <div className="card-title">
              <div>
                <span>EVENT STORE</span>
                <h2>آخر الأحداث</h2>
              </div>
              <Activity />
            </div>
            <div className="admin-events">
              {world.events.slice(0, 8).map((event) => (
                <article key={event.id}>
                  <CheckCircle2 />
                  <div>
                    <b>{event.titleAr}</b>
                    <small>
                      {event.type} · {event.confidence.toFixed(2)}
                    </small>
                  </div>
                  <span>{event.simulationYear}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
