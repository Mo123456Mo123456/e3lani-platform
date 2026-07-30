"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { WorldDelta, WorldOverview } from "@planet/shared-types";
import { AuthDialog } from "./auth-dialog";
import { ContributionDialog } from "./contribution-dialog";
import { api, realtimeUrl } from "@/lib/api";
import { dictionary } from "@/lib/dictionary";
import { useUiStore, type GraphicsQuality } from "@/lib/store";

const PlanetScene = dynamic(
  () => import("./planet-scene").then((module) => module.PlanetScene),
  { ssr: false, loading: () => <div className="planet-loading"><span />جارٍ تجهيز WebGL…</div> },
);

const eventLabels: Record<string, string> = {
  WORLD_CREATED: "نشأة العالم",
  CONTRIBUTION_ADDED: "مساهمة جديدة",
  VEGETATION_SPREAD: "انتشار نباتي",
  SPECIES_CREATED: "ظهور مخلوق",
  TICK_COMPLETED: "تقدم المحاكاة",
  POLLUTION_CHANGED: "تغير التلوث",
  TECHNOLOGY_DISCOVERED: "اكتشاف تقنية",
  WAR_STARTED: "اندلاع حرب",
  MIGRATION_STARTED: "هجرة جماعية",
  CLIMATE_CHANGED: "تغير مناخي",
};

function mergeDelta(current: WorldOverview | undefined, delta: WorldDelta): WorldOverview | undefined {
  if (!current || current.state.planetId !== delta.planetId || current.state.version !== delta.fromVersion) {
    return current;
  }
  const regionChanges = new Map(delta.changedRegions.map((region) => [region.id, region]));
  const civilizationChanges = new Map(
    delta.changedCivilizations.map((civilization) => [civilization.id, civilization]),
  );
  return {
    ...current,
    state: {
      ...current.state,
      version: delta.toVersion,
      tick: delta.tick,
      year: delta.year,
      regions: current.state.regions.map((region) => ({
        ...region,
        ...regionChanges.get(region.id),
      })),
      civilizations: current.state.civilizations.map((civilization) => ({
        ...civilization,
        ...civilizationChanges.get(civilization.id),
      })),
    },
    recentEvents: [...delta.events, ...current.recentEvents].slice(0, 60),
  };
}

export function WorldDashboard() {
  const queryClient = useQueryClient();
  const locale = useUiStore((state) => state.locale);
  const quality = useUiStore((state) => state.quality);
  const selectedRegion = useUiStore((state) => state.selectedRegion);
  const selectRegion = useUiStore((state) => state.selectRegion);
  const accessToken = useUiStore((state) => state.accessToken);
  const setAccessToken = useUiStore((state) => state.setAccessToken);
  const setLocale = useUiStore((state) => state.setLocale);
  const setQuality = useUiStore((state) => state.setQuality);
  const [showAuth, setShowAuth] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const t = dictionary[locale];

  const world = useQuery({
    queryKey: ["world"],
    queryFn: () => api<WorldOverview>("/v1/world"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    api<{ accessToken: string }>("/v1/auth/refresh", { method: "POST" })
      .then((session) => setAccessToken(session.accessToken))
      .catch(() => undefined);
  }, [setAccessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = new WebSocket(realtimeUrl(accessToken));
    socket.onmessage = (message) => {
      const data = JSON.parse(String(message.data)) as { type: string; payload?: WorldDelta };
      if (data.type === "world.delta" && data.payload) {
        queryClient.setQueryData<WorldOverview>(["world"], (current) =>
          mergeDelta(current, data.payload!),
        );
      }
    };
    return () => socket.close();
  }, [accessToken, queryClient]);

  const runTick = useMutation({
    mutationFn: () =>
      api("/v1/world/ticks", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ count: 1 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["world"] }),
  });

  const totalPopulation = useMemo(
    () => world.data?.state.civilizations.reduce((sum, item) => sum + item.population, 0) ?? 0,
    [world.data],
  );

  if (world.isPending) {
    return <main className="boot-screen"><span className="boot-orbit" /><h1>{t.title}</h1><p>تتم مزامنة سجل العالم من PostgreSQL…</p></main>;
  }
  if (world.isError || !world.data) {
    return (
      <main className="boot-screen error-state">
        <h1>تعذر تحميل العالم الحقيقي</h1>
        <p>لم نعرض بيانات بديلة. تأكد من تشغيل API وPostgreSQL ثم أعد المحاولة.</p>
        <button className="primary-button" onClick={() => world.refetch()}>إعادة المحاولة</button>
      </main>
    );
  }

  const overview = world.data;
  const openContribution = () => (accessToken ? setShowContribution(true) : setShowAuth(true));
  const currentSelected = selectedRegion
    ? overview.state.regions.find((region) => region.id === selectedRegion.id) ?? selectedRegion
    : null;

  return (
    <main className="world-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-planet">◉</span>
          <div><strong>{t.title}</strong><small>{t.tagline}</small></div>
        </div>
        <nav aria-label="التنقل الرئيسي">
          {t.nav.map((item, index) => (
            <button key={item} className={index === 0 ? "active" : "pending-feature"} title={index === 0 ? "" : "قيد التطوير"}>
              {item}{index > 0 && <i />}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <select
            aria-label={t.quality}
            value={quality}
            onChange={(event) => setQuality(event.target.value as GraphicsQuality)}
          >
            <option value="ultra">Ultra</option><option value="high">High</option>
            <option value="medium">Medium</option><option value="eco">Eco</option>
          </select>
          <button onClick={() => setLocale(locale === "ar" ? "en" : "ar")} aria-label="تغيير اللغة">
            {locale === "ar" ? "EN" : "ع"}
          </button>
          {accessToken ? (
            <button onClick={async () => { await api("/v1/auth/logout", { method: "POST" }); setAccessToken(null); }}>
              {t.logout}
            </button>
          ) : <button onClick={() => setShowAuth(true)}>{t.login}</button>}
        </div>
      </header>

      <section className="dashboard-grid">
        <aside className="event-panel glass-panel">
          <div className="panel-heading">
            <div><small>LIVE CAUSAL FEED</small><h2>{t.events}</h2></div>
            <span className="live-dot">مباشر</span>
          </div>
          <div className="event-list">
            {overview.recentEvents.map((event, index) => (
              <button
                className={`event-card event-${index % 5}`}
                key={event.id}
                onClick={() => {
                  const region = overview.state.regions.find((item) => item.id === event.regionId);
                  if (region) selectRegion(region);
                }}
              >
                <span className="event-icon">{event.type === "TICK_COMPLETED" ? "◷" : event.type.includes("POLLUTION") ? "≈" : "✦"}</span>
                <span>
                  <strong>{eventLabels[event.type] ?? event.type.replaceAll("_", " ")}</strong>
                  <small>{event.cause}</small>
                  <em>السنة {event.year} · ثقة {Math.round(event.confidence * 100)}%</em>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="planet-viewport" aria-label="الكوكب التفاعلي">
          <div className="world-stats">
            <div><small>{t.year}</small><strong>{overview.state.year.toLocaleString(locale)}</strong></div>
            <div><small>{t.civilizations}</small><strong>{overview.state.civilizations.length}</strong></div>
            <div><small>السكان</small><strong>{Intl.NumberFormat(locale, { notation: "compact" }).format(totalPopulation)}</strong></div>
          </div>
          <PlanetScene regions={overview.state.regions} events={overview.recentEvents} />
          <div className="layer-switcher">
            <button className="active">السطح</button>
            <button title="بياناتها متاحة، وعرضها قيد التطوير">المناخ <i /></button>
            <button title="بياناتها متاحة، وعرضها قيد التطوير">الحضارات <i /></button>
            <button title="قيد التطوير">الهجرات <i /></button>
          </div>
          {currentSelected && (
            <article className="region-popover glass-panel">
              <button onClick={() => selectRegion(null)} aria-label="إغلاق">×</button>
              <small>{t.region}</small>
              <h3>{currentSelected.biome.replaceAll("_", " ")}</h3>
              <div className="region-values">
                <span>الحرارة <b>{Math.round(currentSelected.temperature * 100)}%</b></span>
                <span>الرطوبة <b>{Math.round(currentSelected.moisture * 100)}%</b></span>
                <span>الخصوبة <b>{Math.round(currentSelected.fertility * 100)}%</b></span>
                <span>التلوث <b>{Math.round(currentSelected.pollution * 100)}%</b></span>
              </div>
              <p>{currentSelected.latitude.toFixed(2)}°, {currentSelected.longitude.toFixed(2)}°</p>
            </article>
          )}
        </section>

        <aside className="action-panel glass-panel">
          <p className="eyebrow">ONE CHOICE · MANY CONSEQUENCES</p>
          <h2>{t.add}</h2>
          <p>{t.addHint}</p>
          <button className="add-orbit" onClick={openContribution}><span>＋</span></button>
          <div className="category-mini-grid">
            {["مخلوق", "نبات", "مورد", "حضارة", "اختراع", "ظاهرة"].map((item, index) => (
              <button key={item} onClick={openContribution}><span>{["◉","♧","◆","▥","⚙","✦"][index]}</span>{item}</button>
            ))}
          </div>
          <div className="impact-callout">
            <strong>ماذا سيحدث بعد إضافتك؟</strong>
            <span>64 مسار Monte Carlo عبر 1، 10، 100، 1000 سنة</span>
          </div>
          <div className="account-impact">
            <div><strong>{overview.contributionCount}</strong><span>{t.contributions}</span></div>
            <div><strong>{overview.state.version}</strong><span>نسخة العالم</span></div>
            <div><strong>{overview.state.species.length}</strong><span>{t.species}</span></div>
          </div>
        </aside>
      </section>

      <footer className="timeline-panel glass-panel">
        <div className="timeline-controls">
          <button
            className="play-button"
            onClick={() => accessToken ? runTick.mutate() : setShowAuth(true)}
            disabled={runTick.isPending}
            aria-label={t.run}
          >
            {runTick.isPending ? "…" : "▶"}
          </button>
          <div><small>{t.timeline}</small><strong>{t.run}</strong></div>
        </div>
        <div className="timeline-track">
          {overview.recentEvents.slice(0, 8).reverse().map((event, index) => (
            <button key={event.id} className={index === 7 ? "current" : ""}>
              <span>{event.year}</span><i /><small>{eventLabels[event.type] ?? event.type}</small>
            </button>
          ))}
        </div>
        <div className="timeline-now"><small>{t.tick}</small><strong>{overview.state.tick}</strong></div>
      </footer>

      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
      {showContribution && <ContributionDialog world={overview} onClose={() => setShowContribution(false)} />}
    </main>
  );
}
