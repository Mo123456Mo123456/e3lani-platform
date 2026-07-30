"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

type Stats = {
  elements: number;
  impacts: number;
  days: number;
};

const CATS = [
  "creature",
  "plant",
  "resource",
  "civilization",
  "invention",
  "climate_phenomenon",
  "disease",
  "culture",
  "natural_law",
  "custom",
] as const;

export function ActionPanel({ onOpenAdd }: { onOpenAdd: (cat?: string) => void }) {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setQuality = useAppStore((s) => s.setQuality);
  const quality = useAppStore((s) => s.graphicsQuality);
  const setLayer = useAppStore((s) => s.setLayer);
  const layer = useAppStore((s) => s.layer);
  const d = t(locale);
  const [stats, setStats] = useState<Stats>({ elements: 0, impacts: 0, days: 47 });

  useEffect(() => {
    if (!user) return;
    api<{ contributions: { impactCount: number }[] }>("/contributions/mine")
      .then((r) => {
        setStats({
          elements: r.contributions.length,
          impacts: r.contributions.reduce((a, c) => a + (c.impactCount ?? 0), 0),
          days: 47,
        });
      })
      .catch(() => undefined);
  }, [user]);

  return (
    <aside
      className="panel fade-in"
      style={{
        width: 300,
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.85rem",
      }}
    >
      <button
        className="btn btn-primary"
        type="button"
        style={{ fontSize: "0.95rem", padding: "0.9rem" }}
        onClick={() => onOpenAdd()}
      >
        ＋ {d.addElement}
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            className="btn"
            style={{ fontSize: "0.72rem", padding: "0.45rem" }}
            onClick={() => onOpenAdd(c)}
          >
            {d.categories[c]}
          </button>
        ))}
      </div>

      <div
        className="panel"
        style={{
          padding: "0.75rem",
          background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(34,211,238,0.08))",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{d.whatHappens}</div>
        <button
          className="btn"
          type="button"
          style={{ width: "100%" }}
          onClick={() => onOpenAdd()}
        >
          {d.previewCausal}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
        {[
          [stats.elements, d.addedElements],
          [stats.impacts, d.totalImpacts],
          [stats.days, d.evolutionDays],
        ].map(([v, label]) => (
          <div
            key={String(label)}
            style={{
              textAlign: "center",
              padding: "0.5rem 0.25rem",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
          >
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--cyan)" }}>{v}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
          {d.layers}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {["surface", "civilization", "pollution", "conflict", "weather"].map((l) => (
            <button
              key={l}
              type="button"
              className="chip"
              style={{
                borderColor: layer === l ? "var(--cyan)" : "var(--border)",
                color: layer === l ? "var(--cyan)" : undefined,
                background: "transparent",
                cursor: "pointer",
              }}
              onClick={() => setLayer(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
          {d.quality}
        </div>
        <select
          value={quality}
          onChange={(e) =>
            setQuality(e.target.value as "ultra" | "high" | "medium" | "power_saver")
          }
          style={{
            width: "100%",
            background: "var(--bg-panel-solid)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.4rem",
          }}
        >
          <option value="ultra">ultra</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="power_saver">power_saver</option>
        </select>
      </div>
    </aside>
  );
}
