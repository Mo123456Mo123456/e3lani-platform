"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, eventSchema, type WorldEvent } from "@/lib/api";
import { connectWorldSocket } from "@/lib/ws";
import type { Dictionary, Locale } from "@/lib/i18n";
import { useWorldStore, type Quality } from "@/lib/store";
import PlanetScene from "@/components/planet/PlanetScene";
import { ContributionWizard } from "@/components/contribution/ContributionWizard";
import { TopNav } from "./TopNav";
import { EventLog } from "./EventLog";
import { AddElementPanel } from "./AddElementPanel";
import { Timeline } from "./Timeline";

export function WorldDashboard({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const events = useWorldStore((state) => state.events);
  const quality = useWorldStore((state) => state.quality);
  const setQuality = useWorldStore((state) => state.setQuality);
  const setEvents = useWorldStore((state) => state.setEvents);
  const pushEvent = useWorldStore((state) => state.pushEvent);
  const selected = useWorldStore((state) => state.selectedLocation);
  const setSelected = useWorldStore((state) => state.setSelectedLocation);
  const [socketConnected, setSocketConnected] = useState(false);

  const query = useQuery({
    queryKey: ["world-events"],
    queryFn: async () => {
      const payload = await api<unknown>("/events?limit=24");
      const list = Array.isArray(payload)
        ? payload
        : typeof payload === "object" && payload && "events" in payload
          ? (payload as { events: unknown[] }).events
          : [];
      return list.map((item) => eventSchema.parse(item));
    },
  });

  useEffect(() => {
    if (query.data) setEvents(query.data);
  }, [query.data, setEvents]);

  useEffect(
    () =>
      connectWorldSocket(
        (event: WorldEvent) => pushEvent(event),
        (connected) => setSocketConnected(connected),
      ),
    [pushEvent],
  );

  return (
    <main className="world-shell">
      <TopNav locale={locale} dictionary={dictionary} />

      <div className="dashboard-grid">
        <EventLog events={events} dictionary={dictionary} connected={!query.isError || socketConnected} />

        <section className="planet-stage">
          <div className="planet-title">
            <span><i /> PLANET K-07</span>
            <h1>{dictionary.brand}</h1>
            <p>{dictionary.tagline}</p>
          </div>

          <PlanetScene events={events} quality={quality} onPick={setSelected} />

          <div className="planet-controls glass-panel">
            <label>
              {dictionary.quality}
              <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}>
                {(Object.keys(dictionary.qualities) as Quality[]).map((key) => (
                  <option value={key} key={key}>{dictionary.qualities[key]}</option>
                ))}
              </select>
            </label>
            <span>↻ &nbsp; ＋ / −</span>
          </div>

          {selected && (
            <div className="region-card glass-panel">
              <span className="eyebrow">{dictionary.selectedRegion}</span>
              <strong>{selected.latitude.toFixed(2)}°, {selected.longitude.toFixed(2)}°</strong>
              <small>{dictionary.latitude} / {dictionary.longitude}</small>
            </div>
          )}
        </section>

        <AddElementPanel dictionary={dictionary} />
        <Timeline dictionary={dictionary} />
      </div>

      <ContributionWizard dictionary={dictionary} />
    </main>
  );
}
