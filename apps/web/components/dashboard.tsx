"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { QueryProvider } from "./query-provider";
import { PlanetScene } from "./planet-scene";
import { ContributionWizard } from "./contribution-wizard";
import { fetchEvents, fetchPlanet } from "../lib/api";
import { dictionaries } from "../lib/i18n";
import { useWorldStore } from "../store/world-store";

function DashboardInner() {
  const locale = useWorldStore((state) => state.locale);
  const setLocale = useWorldStore((state) => state.setLocale);
  const quality = useWorldStore((state) => state.quality);
  const setQuality = useWorldStore((state) => state.setQuality);
  const t = dictionaries[locale];
  const planetQuery = useQuery({ queryKey: ["planet"], queryFn: () => fetchPlanet() });
  const eventsQuery = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents(), refetchInterval: 5000 });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4010";
    const socket = new WebSocket(url);
    socket.onmessage = () => eventsQuery.refetch();
    return () => socket.close();
  }, [eventsQuery]);

  const events = eventsQuery.data?.events ?? planetQuery.data?.snapshot.events ?? [];
  const planet = planetQuery.data?.planet;

  return (
    <main className="dashboard-shell">
      <nav className="top-nav">
        <div className="brand">
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="nav-actions">
          <select className="pill" value={quality} onChange={(event) => setQuality(event.target.value as any)} aria-label={t.quality}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button className="secondary-button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>{locale === "ar" ? "English" : "العربية"}</button>
        </div>
      </nav>

      <section className="layout-grid">
        <aside className="side-panel">
          <h2>{t.events}</h2>
          {eventsQuery.error ? <p className="status-warn">{t.apiDown}</p> : null}
          <div className="event-list">
            {events.slice(-16).reverse().map((event) => (
              <article className={`event-card event-type-${event.type}`} key={event.id}>
                <small>#{event.tick} / {event.type}</small>
                <h3>{event.title}</h3>
                <p>{event.description}</p>
              </article>
            ))}
          </div>
        </aside>

        <section className="planet-panel">
          <div className="planet-overlay">
            <strong>{t.planet}</strong>
            <span>{planet ? `${planet.regions.length} regions / year ${planet.ageYears}` : t.apiDown}</span>
          </div>
          <div className="canvas-wrap">
            <PlanetScene regions={planet?.regions ?? []} quality={quality} />
          </div>
        </section>

        <aside className="contribution-panel">
          <h2>{t.contribution}</h2>
          <ContributionWizard planetId={planet?.id ?? "planet-kawkab-demo-seed"} locale={locale} />
        </aside>
      </section>

      <footer className="bottom-timeline" aria-label={t.timeline}>
        <strong>{t.timeline}</strong>
        {events.slice(-12).map((event) => (
          <div className="tick-dot" key={event.id}>
            <small>Y{event.tick}</small>
            <div>{event.title}</div>
          </div>
        ))}
      </footer>
    </main>
  );
}

export function Dashboard() {
  return (
    <QueryProvider>
      <DashboardInner />
    </QueryProvider>
  );
}
