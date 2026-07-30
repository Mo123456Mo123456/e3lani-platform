"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { TopBar } from "@/components/layout/TopBar";
import { EventLog, type EventItem } from "@/components/panels/EventLog";
import { ContributionPanel } from "@/components/panels/ContributionPanel";
import { Timeline, type Milestone } from "@/components/panels/Timeline";
import { RegionDrawer } from "@/components/panels/RegionDrawer";
import { AuthModal } from "@/components/AuthModal";
import { api, API_URL } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { OverlayMarker, RegionPoint } from "@/components/planet/PlanetGlobe";
import { t } from "@/lib/i18n";

const PlanetGlobe = dynamic(
  () => import("@/components/planet/PlanetGlobe").then((m) => m.PlanetGlobe),
  { ssr: false },
);

interface PlanetSummary {
  id: string;
  name: string;
  nameAr: string;
  ageYears: number;
  tick: number;
  civilizationCount: number;
  activeWars: number;
  globalPollution: number;
  globalStability: number;
}

export default function HomePage() {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setLocale = useAppStore((s) => s.setLocale);
  const selectedRegionId = useAppStore((s) => s.selectedRegionId);
  const setSelectedRegionId = useAppStore((s) => s.setSelectedRegionId);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const timePlaying = useAppStore((s) => s.timePlaying);
  const setTimePlaying = useAppStore((s) => s.setTimePlaying);

  const [authOpen, setAuthOpen] = useState(false);
  const [planet, setPlanet] = useState<PlanetSummary | null>(null);
  const [regions, setRegions] = useState<RegionPoint[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<{
    elementsAdded: number;
    totalImpacts: number;
    impactAgeDays: number;
  } | null>(null);
  const [regionDetail, setRegionDetail] = useState<Parameters<typeof RegionDrawer>[0]["data"]>(null);
  const [markers, setMarkers] = useState<OverlayMarker[]>([]);
  const [civs, setCivs] = useState<Array<{ id: string; nameAr: string; regionIds: string[] }>>([]);

  const refresh = useCallback(async () => {
    const [p, state, ev, tl] = await Promise.all([
      api<{ planet: PlanetSummary }>("/planet", { auth: false }),
      api<{
        state: {
          regions: RegionPoint[];
          civilizations: Array<{ id: string; nameAr: string; regionIds: string[]; lat?: number }>;
          wars: Array<{ id: string; regionId: string }>;
          migrations: Array<{ id: string; toRegionId: string }>;
        };
      }>("/planet/state", { auth: false }),
      api<{ events: EventItem[] }>("/planet/events?limit=30", { auth: false }),
      api<{ milestones: Milestone[]; currentYear: number }>("/planet/timeline", { auth: false }),
    ]);
    setPlanet(p.planet);
    setRegions(state.state.regions);
    setCivs(state.state.civilizations);
    setEvents(ev.events);
    setMilestones(tl.milestones);

    const regionById = new Map(state.state.regions.map((r) => [r.id, r]));
    const nextMarkers: OverlayMarker[] = [];
    for (const w of state.state.wars) {
      const r = regionById.get(w.regionId);
      if (r)
        nextMarkers.push({
          id: w.id,
          lat: r.lat,
          lon: r.lon,
          color: "#ff4d6d",
          label: "war",
          kind: "war",
        });
    }
    for (const m of state.state.migrations) {
      const r = regionById.get(m.toRegionId);
      if (r)
        nextMarkers.push({
          id: m.id,
          lat: r.lat,
          lon: r.lon,
          color: "#b07cff",
          label: "migration",
          kind: "migration",
        });
    }
    for (const c of state.state.civilizations.slice(0, 12)) {
      const r = regionById.get(c.regionIds[0]!);
      if (r)
        nextMarkers.push({
          id: c.id,
          lat: r.lat,
          lon: r.lon,
          color: "#f0c14b",
          label: c.nameAr,
          kind: "civ",
        });
    }
    setMarkers(nextMarkers);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("pb_locale") as "ar" | "en" | null;
    if (saved) setLocale(saved);
    refresh().catch(console.error);

    const token = localStorage.getItem("pb_access");
    if (token) {
      api<{ user: NonNullable<typeof user> }>("/auth/me")
        .then((d) => setUser(d.user))
        .catch(() => localStorage.removeItem("pb_access"));
      api<{ stats: typeof stats }>("/contributions/mine")
        .then((d) => setStats(d.stats))
        .catch(() => undefined);
    }

    const socket: Socket = io(API_URL, { path: "/ws", transports: ["websocket", "polling"] });
    socket.on("realtime", (msg: { type: string }) => {
      if (msg.type.includes("tick") || msg.type.includes("contribution") || msg.type.includes("event")) {
        refresh().catch(console.error);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [refresh, setLocale, setUser]);

  useEffect(() => {
    if (!selectedRegionId) {
      setRegionDetail(null);
      return;
    }
    api<{
      region: NonNullable<typeof regionDetail> extends infer T
        ? T extends { region: infer R }
          ? R
          : never
        : never;
      local: NonNullable<typeof regionDetail> extends infer T
        ? T extends { local: infer L }
          ? L
          : never
        : never;
    }>(`/planet/regions/${selectedRegionId}`, { auth: false })
      .then((d) => setRegionDetail(d as NonNullable<typeof regionDetail>))
      .catch(() => setRegionDetail(null));
  }, [selectedRegionId]);

  useEffect(() => {
    if (!timePlaying) return;
    const id = setInterval(() => {
      api("/planet/tick", { method: "POST", body: JSON.stringify({ steps: 1 }) })
        .then(() => refresh())
        .catch(() => setTimePlaying(false));
    }, 2500);
    return () => clearInterval(id);
  }, [timePlaying, refresh, setTimePlaying]);

  const summaryText = useMemo(() => {
    if (!planet) return t(locale, "loading");
    return locale === "ar"
      ? `${planet.nameAr} · سنة ${Math.round(planet.ageYears)} · ${planet.civilizationCount} حضارة · حروب ${planet.activeWars}`
      : `${planet.name} · Year ${Math.round(planet.ageYears)} · ${planet.civilizationCount} civs · wars ${planet.activeWars}`;
  }, [planet, locale]);

  return (
    <div className="app-shell">
      <TopBar
        onLogin={() => setAuthOpen(true)}
        onLogout={() => {
          localStorage.removeItem("pb_access");
          setUser(null);
        }}
      />

      <main className="main-stage">
        <EventLog
          events={events}
          onFocus={(regionId) => {
            if (!regionId) return;
            const sim = regionId.includes(":") ? regionId.split(":")[1]! : regionId;
            setSelectedRegionId(sim);
          }}
        />

        <section className="planet-stage">
          <div className="planet-summary">{summaryText}</div>
          <PlanetGlobe regions={regions} markers={markers} />
          <RegionDrawer data={regionDetail} onClose={() => setSelectedRegionId(null)} />
          <div className="toolbar">
            <button
              className="pb-btn"
              onClick={() =>
                setQuality(
                  quality === "ultra"
                    ? "high"
                    : quality === "high"
                      ? "medium"
                      : quality === "medium"
                        ? "power_save"
                        : "ultra",
                )
              }
            >
              {quality}
            </button>
            <button
              className="pb-btn"
              onClick={() => {
                api("/planet/tick", { method: "POST", body: JSON.stringify({ steps: 1 }) })
                  .then(() => refresh())
                  .catch(() => setAuthOpen(true));
              }}
            >
              {t(locale, "advanceTime")} +1
            </button>
          </div>
        </section>

        <ContributionPanel
          stats={stats}
          selectedRegionId={selectedRegionId}
          onApplied={() => {
            refresh().catch(console.error);
            if (user) {
              api<{ stats: typeof stats }>("/contributions/mine")
                .then((d) => setStats(d.stats))
                .catch(() => undefined);
            }
          }}
        />
      </main>

      <Timeline
        milestones={milestones}
        currentYear={planet?.ageYears ?? 0}
        playing={timePlaying}
        onPlay={() => {
          if (!user) {
            setAuthOpen(true);
            return;
          }
          setTimePlaying(!timePlaying);
        }}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {/* keep civs referenced for future layer toggles */}
      <span style={{ display: "none" }}>{civs.length}</span>
    </div>
  );
}
