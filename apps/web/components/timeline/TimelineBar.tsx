"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

type Snap = {
  id: string;
  year: number;
  tick: number;
  label: string;
  labelAr: string;
  summary: string;
  summaryAr: string;
};

export function TimelineBar() {
  const locale = useAppStore((s) => s.locale);
  const d = t(locale);
  const [snaps, setSnaps] = useState<Snap[]>([]);

  useEffect(() => {
    api<{ snapshots: Snap[] }>("/timeline")
      .then((r) => setSnaps(r.snapshots))
      .catch(() => undefined);
  }, []);

  return (
    <footer
      className="panel"
      style={{
        margin: "0 1rem 1rem",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{d.timeline}</strong>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{d.worldEvolving}</span>
      </div>
      <div
        className="scroll-y"
        style={{
          display: "flex",
          gap: "0.55rem",
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {snaps.map((s, i) => (
          <div
            key={s.id}
            style={{
              minWidth: 160,
              border: `1px solid ${i === snaps.length - 1 ? "rgba(34,211,238,0.55)" : "var(--border)"}`,
              borderRadius: 10,
              padding: "0.55rem 0.65rem",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "var(--cyan)" }}>
              {s.year} · T{s.tick}
              {i === snaps.length - 1 && (
                <span className="chip" style={{ marginInlineStart: 6 }}>
                  <span className="live-dot" /> {d.live}
                </span>
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.82rem", marginTop: 2 }}>
              {locale === "ar" ? s.labelAr : s.label}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 2 }}>
              {(locale === "ar" ? s.summaryAr : s.summary).slice(0, 70)}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
