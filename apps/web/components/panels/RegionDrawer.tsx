"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

export function RegionDrawer() {
  const id = useAppStore((s) => s.selectedRegionId);
  const selectRegion = useAppStore((s) => s.selectRegion);
  const locale = useAppStore((s) => s.locale);
  const d = t(locale);
  const [data, setData] = useState<{
    region: Record<string, unknown>;
    civilization: { name: string; nameAr: string; population: number } | null;
    resources: { name: string; nameAr: string }[];
    plants: { name: string; nameAr: string }[];
    species: { name: string; nameAr: string }[];
  } | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    api<typeof data extends null ? never : NonNullable<typeof data>>(`/planet/regions/${id}`)
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  if (!id || !data) return null;
  const r = data.region;

  return (
    <div
      className="panel fade-in"
      style={{
        position: "absolute",
        bottom: 120,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(420px, calc(100% - 2rem))",
        padding: "0.85rem 1rem",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{d.regionData}</strong>
        <button className="btn btn-ghost" type="button" onClick={() => selectRegion(null)}>
          ✕
        </button>
      </div>
      <div style={{ fontSize: "0.85rem", marginTop: 6 }}>
        {(locale === "ar" ? (r.nameAr as string) : (r.name as string)) ?? id} · {String(r.biome)}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginTop: 8,
          fontSize: "0.75rem",
        }}
      >
        <span>T {(Number(r.temperature) * 100).toFixed(0)}%</span>
        <span>M {(Number(r.moisture) * 100).toFixed(0)}%</span>
        <span>F {(Number(r.fertility) * 100).toFixed(0)}%</span>
        <span>Pop {Number(r.population)}</span>
        <span>Pol {(Number(r.pollution) * 100).toFixed(0)}%</span>
        <span>
          {data.civilization
            ? locale === "ar"
              ? data.civilization.nameAr
              : data.civilization.name
            : "—"}
        </span>
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 8 }}>
        {locale === "ar" ? "موارد" : "Resources"}:{" "}
        {data.resources
          .slice(0, 3)
          .map((x) => (locale === "ar" ? x.nameAr : x.name))
          .join(" · ") || "—"}
      </div>
    </div>
  );
}
