"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@planet/ui";
import { TopBar } from "@/components/panels/TopBar";
import { EventFeed } from "@/components/panels/EventFeed";
import { ContributePanel } from "@/components/panels/ContributePanel";
import { TimelineBar } from "@/components/panels/TimelineBar";
import { RegionPanel } from "@/components/panels/RegionPanel";
import { LayerToggles } from "@/components/panels/LayerToggles";
import { StatsBar } from "@/components/panels/StatsBar";
import { useWorld } from "@/lib/useWorld";
import { useUiStore, useWorldStore } from "@/lib/store";
import { connectRealtime } from "@/lib/ws";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { setAccessToken } from "@/lib/api";

const PlanetCanvas = dynamic(
  () => import("@/components/planet/PlanetCanvas").then((m) => m.PlanetCanvas),
  { ssr: false, loading: () => <LoadingGlobe /> },
);

function LoadingGlobe() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <Spinner size={42} />
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const { bundle, mode } = useWorld();
  const { selectCell, notifications } = useUiStore();
  const worldId = useWorldStore((s) => s.worldId);
  const setUser = useAuthStore((s) => s.setUser);

  // Restore session silently (refresh cookie).
  useEffect(() => {
    if (localStorage.getItem("planet-has-session") !== "1") return;
    api<{ accessToken: string }>("/auth/refresh", { method: "POST" })
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        return api<{ id: string; email: string; role: string; profile?: { displayName?: string } }>("/users/me", { auth: true });
      })
      .then((me) => setUser({ id: me.id, email: me.email, role: me.role, displayName: me.profile?.displayName }))
      .catch(() => setAccessToken(null));
  }, [setUser]);

  // Realtime channel (live mode only).
  useEffect(() => {
    if (mode !== "live" || !worldId) return;
    return connectRealtime(worldId);
  }, [mode, worldId]);

  const handleCellClick = useMemo(
    () => (cell: number) => selectCell(cell),
    [selectCell],
  );

  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">
        {bundle ? (
          <PlanetCanvas grid={bundle.grid} snapshot={bundle.snapshot} onCellClick={handleCellClick} />
        ) : (
          <LoadingGlobe />
        )}

        <StatsBar />
        <LayerToggles />
        <RegionPanel />

        {mode === "local-preview" && (
          <div
            style={{
              position: "absolute", top: 110, left: "50%", transform: "translateX(-50%)",
              zIndex: 30, fontSize: 11, color: "var(--planet-orange)",
              background: "rgba(5,10,20,0.7)", padding: "4px 12px", borderRadius: 999,
              border: "1px solid var(--planet-orange)",
            }}
          >
            {t.common.localPreview}
          </div>
        )}

        {/* Right panel: contribution flow (RTL: appears left via flex order) */}
        <aside
          style={{
            position: "absolute", top: 110, bottom: 84, insetInlineEnd: 16, width: 320, zIndex: 35,
          }}
        >
          <ContributePanel />
        </aside>

        {/* Left panel: live events */}
        <aside
          style={{
            position: "absolute", top: 110, bottom: 84, insetInlineStart: 16, width: 300, zIndex: 20,
          }}
        >
          <EventFeed />
        </aside>

        <TimelineBar />

        {/* Notification toasts */}
        {notifications.slice(0, 3).map((n) => (
          <div key={n.id} className="toast" style={{ bottom: 90 + notifications.indexOf(n) * 64 }}>
            <strong style={{ color: "var(--planet-accent)", fontSize: 12 }}>{n.title}</strong>
            <div style={{ fontSize: 11, color: "var(--planet-text-dim)", marginTop: 2 }}>{n.body}</div>
          </div>
        ))}
      </main>
    </div>
  );
}
