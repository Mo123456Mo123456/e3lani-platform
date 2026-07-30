
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryProvider } from "./query-provider";
import { PlanetScene } from "./planet-scene";
import { ContributionWizard } from "./contribution-wizard";
import { AuthPanel } from "./auth-panel";
import { fetchCausalGraph, fetchEvents, fetchNotifications, fetchPlanet, fetchTimeline, runScenarios } from "../lib/api";
import { dictionaries } from "../lib/i18n";
import { useWorldStore } from "../store/world-store";

function CausalGraph({ graph }: { graph?: { nodes: Array<{ id: string; title: string; tick: number }>; edges: Array<{ fromEventId: string; toEventId: string }> } }) {
  const nodes = graph?.nodes.slice(-24) ?? [];
  return (
    <svg className="causal-svg" viewBox="0 0 420 180" role="img">
      {nodes.map((node, index) => {
        const x = 18 + (index % 8) * 52;
        const y = 25 + Math.floor(index / 8) * 52;
        return <g key={node.id}><circle cx={x} cy={y} r="10" fill="#2de2e6" opacity="0.8" /><text x={x + 12} y={y + 4} fill="#eafcff" fontSize="9">{node.tick}</text></g>;
      })}
      {(graph?.edges ?? []).slice(-36).map((edge, index) => {
        const from = nodes.findIndex((node) => node.id === edge.fromEventId);
        const to = nodes.findIndex((node) => node.id === edge.toEventId);
        if (from < 0 || to < 0) return null;
        return <line key={`${edge.fromEventId}-${edge.toEventId}-${index}`} x1={18 + (from % 8) * 52} y1={25 + Math.floor(from / 8) * 52} x2={18 + (to % 8) * 52} y2={25 + Math.floor(to / 8) * 52} stroke="#9b5cff" strokeOpacity="0.45" />;
      })}
    </svg>
  );
}

function DashboardInner() {
  const locale = useWorldStore((state) => state.locale);
  const setLocale = useWorldStore((state) => state.setLocale);
  const quality = useWorldStore((state) => state.quality);
  const setQuality = useWorldStore((state) => state.setQuality);
  const layer = useWorldStore((state) => state.layer);
  const setLayer = useWorldStore((state) => state.setLayer);
  const token = useWorldStore((state) => state.token);
  const setToken = useWorldStore((state) => state.setToken);
  const [selectedTick, setSelectedTick] = useState<number>();
  const [confirmResult, setConfirmResult] = useState<any>();
  const t = dictionaries[locale];
  const planetQuery = useQuery({ queryKey: ["planet"], queryFn: () => fetchPlanet() });
  const eventsQuery = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents(), refetchInterval: 5000 });
  const timelineQuery = useQuery({ queryKey: ["timeline"], queryFn: () => fetchTimeline() });
  const graphQuery = useQuery({ queryKey: ["graph"], queryFn: () => fetchCausalGraph() });
  const notificationsQuery = useQuery({ queryKey: ["notifications", token], enabled: Boolean(token), queryFn: () => fetchNotifications(token) });
  const futuresQuery = useQuery({ queryKey: ["futures"], queryFn: () => runScenarios(20, 6), refetchInterval: 30000 });

  useEffect(() => {
    const saved = localStorage.getItem("kawkab-token");
    if (saved && !token) setToken(saved);
  }, [setToken, token]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4010";
    const socket = new WebSocket(url);
    socket.onmessage = () => {
      eventsQuery.refetch();
      planetQuery.refetch();
      timelineQuery.refetch();
      graphQuery.refetch();
      notificationsQuery.refetch();
    };
    return () => socket.close();
  }, []);

  const events = eventsQuery.data?.events ?? planetQuery.data?.snapshot.events ?? [];
  const planet = planetQuery.data?.planet;
  const timeline = timelineQuery.data?.snapshots ?? [];
  const selectedSnapshot = useMemo(() => timeline.find((snap) => snap.tick === selectedTick) ?? timeline.at(-1), [timeline, selectedTick]);

  return (
    <main className="dashboard-shell">
      <nav className="top-nav">
        <div className="brand"><h1>{t.title}</h1><p>{t.tagline}</p></div>
        <div className="nav-actions">
          <select className="pill" value={layer} onChange={(event) => setLayer(event.target.value as any)} aria-label={t.layer}><option value="biomes">biomes</option><option value="temperature">temperature</option><option value="resources">resources</option></select>
          <select className="pill" value={quality} onChange={(event) => setQuality(event.target.value as any)} aria-label={t.quality}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          <button className="secondary-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "English" : "العربية"}</button>
        </div>
      </nav>

      <section className="layout-grid">
        <aside className="side-panel">
          <h2>{t.events}</h2>
          {eventsQuery.error ? <p className="status-warn">{t.apiDown}</p> : null}
          <div className="event-list">{events.slice(-14).reverse().map((event) => <article className={`event-card event-type-${event.type}`} key={event.id}><small>#{event.tick} / {event.type}</small><h3>{event.title}</h3><p>{event.description}</p></article>)}</div>
          <h2>{t.causalGraph}</h2>
          <CausalGraph graph={graphQuery.data} />
        </aside>

        <section className="planet-panel">
          <div className="planet-overlay"><strong>{t.planet}</strong><span>{planet ? `${planetQuery.data?.counts.civilizations} civs / ${planetQuery.data?.counts.cities} cities / year ${planet.ageYears}` : t.apiDown}</span></div>
          <div className="canvas-wrap"><PlanetScene regions={planet?.regions ?? []} quality={quality} layer={layer} cities={planetQuery.data?.cities ?? []} events={events} /></div>
        </section>

        <aside className="contribution-panel">
          <AuthPanel locale={locale} />
          <h2>{t.contribution}</h2>
          <ContributionWizard planetId={planet?.id ?? "planet-kawkab-rich-demo"} regions={planet?.regions ?? []} locale={locale} onConfirmed={setConfirmResult} />
          <h2>{t.notifications}</h2>
          <div className="mini-list">{(notificationsQuery.data?.notifications ?? []).slice(0, 5).map((note) => <div className="mini-card" key={note.id}><strong>{note.title}</strong><p>{note.body}</p></div>)}</div>
        </aside>
      </section>

      <section className="bottom-timeline" aria-label={t.timeline}>
        <strong>{t.timeline}</strong>
        {timeline.slice(-24).map((snap) => <button className="tick-dot" key={snap.id} onClick={() => setSelectedTick(snap.tick)}><small>Y{snap.tick}</small><div>{snap.events.at(-1)?.title ?? snap.summary}</div></button>)}
      </section>

      <section className="insight-grid">
        <article className="side-panel"><h2>{t.compare}</h2>{confirmResult ? <pre>{JSON.stringify(confirmResult.comparison, null, 2)}</pre> : <p>{selectedSnapshot?.summary}</p>}</article>
        <article className="side-panel"><h2>{t.futures}</h2>{futuresQuery.data ? <pre>{JSON.stringify({ mostLikely: futuresQuery.data.mostLikely, best: futuresQuery.data.best, worst: futuresQuery.data.worst, uncertainty: futuresQuery.data.uncertainty }, null, 2)}</pre> : <p>...</p>}</article>
      </section>
    </main>
  );
}

export function Dashboard() {
  return <QueryProvider><DashboardInner /></QueryProvider>;
}
