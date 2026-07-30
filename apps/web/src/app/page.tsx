"use client";

/**
 * Home — the living planet dashboard: 3D planet center stage, live event
 * feed left, contribution wizard right, world timeline below.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, loadSession, type StateSummary } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { connectRealtime } from "@/lib/ws";
import { useI18n } from "@/i18n/I18nProvider";
import { TopBar } from "@/components/panels/TopBar";
import { EventFeed } from "@/components/panels/EventFeed";
import { AddElementWizard } from "@/components/panels/AddElementWizard";
import { TimelineBar } from "@/components/panels/TimelineBar";
import { ControlBar } from "@/components/panels/ControlBar";
import { RegionPanel } from "@/components/panels/RegionPanel";
import { CivsModal } from "@/components/panels/CivsModal";
import { NotificationsDropdown } from "@/components/panels/NotificationsDropdown";
import { usePlanetGrid } from "@/components/planet/usePlanetGrid";

const PlanetCanvas = dynamic(
  () => import("@/components/planet/PlanetCanvas").then((m) => m.PlanetCanvas),
  { ssr: false },
);

export default function HomePage() {
  const { t } = useI18n();
  const [planetId, setPlanetId] = useState<string | null>(null);
  const [summary, setSummary] = useState<StateSummary | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const setSession = useAppStore((s) => s.setSession);
  const appendEvents = useAppStore((s) => s.appendEvents);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const user = useAppStore((s) => s.user);
  const { loading, error } = usePlanetGrid(planetId);

  // restore session
  useEffect(() => {
    const session = loadSession();
    if (session) setSession(session);
  }, [setSession]);

  // pick the default planet
  useEffect(() => {
    api
      .planets()
      .then((res) => {
        const first = res.planets[0];
        if (first) setPlanetId(first.id);
        else setBootError("no planet found");
      })
      .catch((err) => setBootError(err instanceof Error ? err.message : "api unreachable"));
  }, []);

  // realtime + initial data
  useEffect(() => {
    if (!planetId) return;
    const disconnect = connectRealtime(planetId);
    void api.events(planetId, "?limit=40").then((res) => appendEvents(res.events.reverse()));
    void api.stateSummary(planetId).then(setSummary).catch(() => undefined);
    const summaryTimer = setInterval(() => {
      void api.stateSummary(planetId).then(setSummary).catch(() => undefined);
    }, 15000);
    return () => {
      disconnect();
      clearInterval(summaryTimer);
    };
  }, [planetId, appendEvents]);

  // notifications for signed-in users
  useEffect(() => {
    if (!user) return;
    void api.notifications().then((res) => setNotifications(res.notifications)).catch(() => undefined);
  }, [user, setNotifications]);

  return (
    <div className="app-shell">
      <TopBar />
      <NotificationsDropdown />
      <main className="main-grid">
        <EventFeed />
        <section className="planet-stage">
          {(loading || !planetId) && (
            <div className="planet-loading">
              <div className="loading-orbit" />
              <p>{bootError ?? error ?? t.common.loading}</p>
            </div>
          )}
          {planetId && !loading && <PlanetCanvas summary={summary} />}
          <ControlBar />
          <RegionPanel />
        </section>
        <AddElementWizard />
      </main>
      <TimelineBar />
      <CivsModal summary={summary} />
    </div>
  );
}
