"use client";

import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/stores/session";
import { useWorldUi } from "@/stores/world-ui";
import { TopNav } from "@/components/TopNav";
import { EventLog } from "@/components/EventLog";
import { RightPanel } from "@/components/RightPanel";
import { Timeline } from "@/components/Timeline";
import { AuthModal } from "@/components/AuthModal";
import { AddElementModal } from "@/components/AddElementModal";
import { RegionDrawer } from "@/components/RegionDrawer";

const PlanetScene = dynamic(
  () => import("@/components/planet/PlanetScene").then((m) => m.PlanetScene),
  { ssr: false, loading: () => <div style={{ height: "100%" }} /> },
);

export default function HomePage() {
  const queryClient = useQueryClient();
  const { token, locale } = useSession();
  const { setPlanetId, selectRegion, setQuality, quality } = useWorldUi();
  const [authOpen, setAuthOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [forecast, setForecast] = useState<string | null>(null);

  const planetsQuery = useQuery({
    queryKey: ["planets"],
    queryFn: api.planets,
  });

  const planetId = String(planetsQuery.data?.planets?.[0]?.id ?? "");

  useEffect(() => {
    if (planetId) setPlanetId(planetId);
  }, [planetId, setPlanetId]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    if (!planetId) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4100/ws";
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: "subscribe", planetId }));
      };
      ws.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ["events", planetId] });
        queryClient.invalidateQueries({ queryKey: ["timeline", planetId] });
        queryClient.invalidateQueries({ queryKey: ["planet", planetId] });
      };
    } catch {
      // ws optional in offline preview
    }
    return () => ws?.close();
  }, [planetId, queryClient]);

  const planetQuery = useQuery({
    queryKey: ["planet", planetId],
    enabled: Boolean(planetId),
    queryFn: () => api.planet(planetId),
  });

  const regionsQuery = useQuery({
    queryKey: ["regions", planetId],
    enabled: Boolean(planetId),
    queryFn: () => api.regions(planetId, 120),
  });

  const eventsQuery = useQuery({
    queryKey: ["events", planetId],
    enabled: Boolean(planetId),
    queryFn: () => api.events(planetId, 28),
    refetchInterval: 12000,
  });

  const timelineQuery = useQuery({
    queryKey: ["timeline", planetId],
    enabled: Boolean(planetId),
    queryFn: () => api.timeline(planetId),
  });

  const impactQuery = useQuery({
    queryKey: ["impact", token],
    enabled: Boolean(token),
    queryFn: () => api.impact(token!),
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", token],
    enabled: Boolean(token && notifyOpen),
    queryFn: () => api.notifications(token!),
  });

  const markers = useMemo(() => {
    const regions = regionsQuery.data?.regions ?? [];
    const colorFor = (biome: string) => {
      if (biome.includes("forest")) return "#34d399";
      if (biome === "desert") return "#fbbf24";
      if (biome === "volcanic") return "#fb923c";
      if (biome === "tundra" || biome === "ice") return "#e2e8f0";
      return "#22d3ee";
    };
    return regions.slice(0, 40).map((r) => ({
      id: String(r.id),
      lat: Number(r.lat),
      lng: Number(r.lng),
      color: colorFor(String(r.biome)),
      label: String(r.name),
    }));
  }, [regionsQuery.data]);

  const overlays = planetQuery.data?.overlays as
    | {
        wars?: Array<{ regionId: string }>;
        civilizations?: Array<{ name: string; capitalRegionId: string }>;
      }
    | null;

  const overlayMarkers = useMemo(() => {
    const extra = [];
    for (const w of overlays?.wars ?? []) {
      const region = (regionsQuery.data?.regions ?? []).find((r) => r.id === w.regionId);
      if (!region) continue;
      extra.push({
        id: `war_${w.regionId}`,
        lat: Number(region.lat),
        lng: Number(region.lng),
        color: "#f87171",
        label: "war",
      });
    }
    return [...markers, ...extra].slice(0, 60);
  }, [markers, overlays, regionsQuery.data]);

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <TopNav onAuth={() => setAuthOpen(true)} onNotify={() => setNotifyOpen((v) => !v)} />

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: "0.85rem",
          padding: "0.85rem 1rem",
          minHeight: 0,
          position: "relative",
        }}
      >
        <EventLog events={(eventsQuery.data?.events as Array<Record<string, unknown>>) ?? []} />

        <section
          style={{
            position: "relative",
            minHeight: 0,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid var(--planet-border)",
            background:
              "radial-gradient(circle at 50% 45%, rgba(34,211,238,0.08), transparent 50%), #030712",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              insetInlineStart: 12,
              zIndex: 5,
              display: "flex",
              gap: 8,
            }}
          >
            {(["ultra", "high", "medium", "battery"] as const).map((q) => (
              <button
                key={q}
                className={`planet-btn ${quality === q ? "planet-btn-primary" : "planet-btn-ghost"}`}
                style={{ padding: "0.35rem 0.55rem", fontSize: "0.7rem" }}
                onClick={() => setQuality(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              top: 12,
              insetInlineEnd: 12,
              zIndex: 5,
              fontSize: "0.75rem",
              color: "var(--planet-muted)",
              background: "rgba(5,11,22,0.65)",
              padding: "0.35rem 0.6rem",
              borderRadius: 999,
              border: "1px solid var(--planet-border)",
            }}
          >
            Y{String(planetQuery.data?.planet?.currentYear ?? "…")} · seed{" "}
            {String(planetQuery.data?.planet?.seed ?? "")}
          </div>
          <PlanetScene
            markers={overlayMarkers}
            onSelectRegion={(id) => selectRegion(id.startsWith("war_") ? id.slice(4) : id)}
          />
          <RegionDrawer />
          {forecast && (
            <div
              className="planet-panel"
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                right: 16,
                padding: "0.8rem 1rem",
                zIndex: 8,
              }}
            >
              {forecast}
              <button
                className="planet-btn planet-btn-ghost"
                style={{ marginInlineStart: 8 }}
                onClick={() => setForecast(null)}
              >
                ✕
              </button>
            </div>
          )}
        </section>

        <RightPanel
          impact={{
            elementsAdded: impactQuery.data?.elementsAdded ?? 0,
            totalChanges: impactQuery.data?.totalChanges ?? 0,
            evolutionDays: impactQuery.data?.evolutionDays ?? 0,
          }}
          onWhatIf={() =>
            setForecast(
              locale === "ar"
                ? "المسارات المستقبلية احتمالية (Monte Carlo). أضف عنصرًا ثم استخدم التوقع من صفحة المساهمة لعرض أفضل/أسوأ/الأكثر احتمالًا."
                : "Future paths are probabilistic (Monte Carlo). Add an element, then use contribution forecast for best/worst/most-likely.",
            )
          }
        />

        {notifyOpen && (
          <div
            className="planet-panel"
            style={{
              position: "absolute",
              top: 8,
              insetInlineEnd: 320,
              width: 300,
              padding: "0.8rem",
              zIndex: 30,
            }}
          >
            <strong>{locale === "ar" ? "الإشعارات" : "Notifications"}</strong>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {(notificationsQuery.data?.notifications ?? []).map((n) => (
                <div key={String(n.id)} style={{ fontSize: "0.8rem" }}>
                  <div style={{ fontWeight: 600 }}>{String(n.title)}</div>
                  <div style={{ color: "var(--planet-muted)" }}>{String(n.body)}</div>
                </div>
              ))}
              {!token && (
                <div style={{ color: "var(--planet-muted)", fontSize: "0.8rem" }}>
                  {locale === "ar" ? "سجّل الدخول لعرض الإشعارات" : "Login to view notifications"}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Timeline items={(timelineQuery.data?.items as Array<Record<string, unknown>>) ?? []} />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AddElementModal
        onApplied={() => {
          queryClient.invalidateQueries();
        }}
      />
    </div>
  );
}
