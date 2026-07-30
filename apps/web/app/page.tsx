"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { EventLog } from "@/components/panels/EventLog";
import { ActionPanel } from "@/components/panels/ActionPanel";
import { RegionDrawer } from "@/components/panels/RegionDrawer";
import { TimelineBar } from "@/components/timeline/TimelineBar";
import { AddElementModal } from "@/components/contribution/AddElementModal";
import { usePlanetSocket } from "@/hooks/usePlanetSocket";
import { api, type AuthUser } from "@/lib/api";
import { useAppStore } from "@/stores/app";

const PlanetScene = dynamic(
  () =>
    import("@/components/planet/PlanetScene").then((m) => m.PlanetScene),
  { ssr: false, loading: () => <div style={{ height: "100%" }} /> },
);

type PlanetPayload = {
  planet: {
    id: string;
    name: string;
    nameAr: string;
    seed: string;
    tick: number;
    year: number;
    stats: Record<string, number>;
  } | null;
  regions: {
    id: string;
    biome: string;
    lat: number;
    lon: number;
    fertility: number;
    population: number;
    pollution: number;
    civilizationId: string | null;
  }[];
  heightPreview: number[][];
};

export default function HomePage() {
  usePlanetSocket();
  const setUser = useAppStore((s) => s.setUser);
  const setTick = useAppStore((s) => s.setTick);
  const setEvents = useAppStore((s) => s.setEvents);
  const setLocale = useAppStore((s) => s.setLocale);
  const [planet, setPlanet] = useState<PlanetPayload | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialCat, setInitialCat] = useState<string | undefined>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, ev] = await Promise.all([
        api<PlanetPayload>("/planet"),
        api<{
          events: {
            id: string;
            type: string;
            tick: number;
            year: number;
            regionId: string | null;
            title: string;
            titleAr: string;
            description: string;
            descriptionAr: string;
            importance: number;
            cause: string | null;
          }[];
        }>("/events?limit=40"),
      ]);
      setPlanet(p);
      if (p.planet) setTick(p.planet.tick, p.planet.year);
      setEvents(ev.events);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setTick, setEvents]);

  useEffect(() => {
    setLocale("ar");
    const token = localStorage.getItem("pb_access");
    if (token) {
      api<{ user: AuthUser }>("/auth/me")
        .then((r) => setUser(r.user))
        .catch(() => undefined);
    }
    void load();
    const id = setInterval(() => void load(), 20000);
    return () => clearInterval(id);
  }, [load, setLocale, setUser]);

  return (
    <div className="app-shell">
      <TopBar />
      <main
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr 300px",
          gap: "0.85rem",
          padding: "0.85rem 1rem",
          minHeight: 0,
          height: "calc(100vh - 180px)",
        }}
      >
        <div className="desktop-only" style={{ minHeight: 0 }}>
          <EventLog />
        </div>

        <section
          style={{
            position: "relative",
            minHeight: 360,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background:
              "radial-gradient(ellipse at center, rgba(20,40,80,0.35), rgba(3,7,15,0.9))",
          }}
        >
          {error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.5)",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ marginBottom: 8 }}>API: {error}</div>
                <button className="btn" type="button" onClick={() => void load()}>
                  Retry
                </button>
              </div>
            </div>
          )}
          {planet && (
            <PlanetScene
              heightPreview={planet.heightPreview}
              regions={planet.regions}
            />
          )}
          {planet?.planet && (
            <div
              style={{
                position: "absolute",
                top: 12,
                insetInlineStart: 12,
                zIndex: 2,
                background: "rgba(5,10,20,0.65)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "0.45rem 0.7rem",
                fontSize: "0.78rem",
              }}
            >
              <strong>{planet.planet.nameAr}</strong> · seed {planet.planet.seed}
              <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
                {planet.planet.stats.civilizations} حضارات ·{" "}
                {planet.planet.stats.species} مخلوقات ·{" "}
                {planet.planet.stats.plants} نباتات ·{" "}
                {planet.planet.stats.resources} موارد
              </div>
            </div>
          )}
          <RegionDrawer />
        </section>

        <div className="desktop-only" style={{ minHeight: 0 }}>
          <ActionPanel
            onOpenAdd={(cat) => {
              setInitialCat(cat);
              setModalOpen(true);
            }}
          />
        </div>
      </main>

      {/* Mobile actions */}
      <div
        style={{
          display: "none",
          padding: "0 1rem 0.5rem",
        }}
        className="mobile-actions"
      />
      <div
        style={{
          position: "fixed",
          bottom: 100,
          insetInlineEnd: 16,
          zIndex: 30,
        }}
      >
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setModalOpen(true)}
          style={{ boxShadow: "var(--glow)" }}
        >
          ＋
        </button>
      </div>

      <TimelineBar />

      <AddElementModal
        open={modalOpen}
        initialCategory={initialCat}
        regions={planet?.regions ?? []}
        onClose={() => setModalOpen(false)}
        onCommitted={() => void load()}
      />

      <style jsx>{`
        @media (max-width: 960px) {
          main {
            grid-template-columns: 1fr !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
