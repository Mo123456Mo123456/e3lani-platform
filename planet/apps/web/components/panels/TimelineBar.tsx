"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorldEvent } from "@planet/shared-types";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useEventsStore, useUiStore, useWorldStore } from "@/lib/store";

const ERA_COLORS = ["#0e7490", "#34d399", "#fbbf24", "#fb923c", "#a78bfa", "#e879f9"];

/**
 * Bottom timeline: world history as an interactive strip. Event density
 * renders as a heat band; clicking a point selects that era; "present"
 * snaps back to live view.
 */
export function TimelineBar() {
  const { t } = useI18n();
  const { worldId, meta, mode } = useWorldStore();
  const events = useEventsStore((s) => s.events);
  const { timelineTick, setTimelineTick } = useUiStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const { data: timeline } = useQuery({
    queryKey: ["timeline", worldId],
    queryFn: () => api<{ tick: number; year: number; state: unknown }[]>(`/worlds/${worldId}/timeline`),
    enabled: mode === "live" && !!worldId,
    staleTime: 60_000,
  });

  const currentTick = meta?.tick ?? 0;
  const currentYear = meta?.year ?? 0;

  const eras = useMemo(() => {
    const eraEvents = events
      .filter((e) => e.type === "ERA_STARTED")
      .sort((a, b) => a.year - b.year);
    return eraEvents;
  }, [events]);

  // Density heat band.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || currentTick === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const buckets = new Float32Array(200);
    for (const e of events) {
      const idx = Math.min(199, Math.floor((e.tick / Math.max(currentTick, 1)) * 200));
      buckets[idx] = (buckets[idx] ?? 0) + e.importance;
    }
    const max = Math.max(...buckets, 1);
    for (let i = 0; i < 200; i++) {
      const v = buckets[i]! / max;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.08 + v * 0.7})`;
      ctx.fillRect((i / 200) * width, height - 6 - v * (height - 14), width / 200 + 1, v * (height - 14) + 6);
    }
    // Era markers.
    for (const era of eras) {
      const x = (era.tick / Math.max(currentTick, 1)) * width;
      ctx.fillStyle = "#e879f9";
      ctx.fillRect(x, 0, 1.5, height);
    }
    // Selected tick cursor.
    if (timelineTick !== null) {
      const x = (timelineTick / Math.max(currentTick, 1)) * width;
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(x, 0, 2, height);
    }
  }, [events, eras, currentTick, timelineTick]);

  const pick = (clientX: number, rect: DOMRect) => {
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const tick = Math.round(frac * currentTick);
    setTimelineTick(tick >= currentTick ? null : tick);
  };

  return (
    <div
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 74, zIndex: 25,
        background: "rgba(5,10,20,0.88)", borderTop: "1px solid var(--planet-border)",
        backdropFilter: "blur(10px)", padding: "6px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: "var(--planet-accent)", fontWeight: 600 }}>{t.timelineBar.title}</span>
        <span style={{ fontSize: 10, color: "var(--planet-text-dim)" }}>
          {timelineTick !== null
            ? `${t.dashboard.year} ${timelineTick * (meta?.yearsPerTick ?? 1)} / ${currentYear}`
            : `${t.dashboard.year} ${currentYear}`}
          {hoverYear !== null && ` · ${hoverYear}`}
        </span>
        {timelineTick !== null && (
          <button className="chip active" onClick={() => setTimelineTick(null)}>
            {t.timelineBar.now}
          </button>
        )}
        <span style={{ flex: 1 }} />
        {eras.map((era, i) => (
          <button
            key={era.seq}
            className="chip"
            style={{ borderColor: ERA_COLORS[i % ERA_COLORS.length], color: ERA_COLORS[i % ERA_COLORS.length], fontSize: 10 }}
            onClick={() => setTimelineTick(era.tick)}
          >
            {String((era.payload as { era?: string }).era ?? "")}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={40}
        style={{ width: "100%", height: 40, cursor: "crosshair", display: "block" }}
        onClick={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
          setHoverYear(Math.round(frac * currentYear));
        }}
        onMouseLeave={() => setHoverYear(null)}
        title={t.timelineBar.scrub}
      />
      {timeline && timeline.length > 1 && (
        <span style={{ display: "none" }}>{timeline.length}</span>
      )}
    </div>
  );
}
