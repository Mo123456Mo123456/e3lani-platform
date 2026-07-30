"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/stores/session";
import { useWorldUi } from "@/stores/world-ui";

export function RegionDrawer() {
  const { planetId, selectedRegionId, selectRegion } = useWorldUi();
  const locale = useSession((s) => s.locale);

  const { data } = useQuery({
    queryKey: ["region", planetId, selectedRegionId],
    enabled: Boolean(planetId && selectedRegionId),
    queryFn: () => api.region(planetId!, selectedRegionId!),
  });

  if (!selectedRegionId || !data) return null;
  const region = (data.region ?? {}) as Record<string, unknown>;
  const civ = data.civilization as Record<string, unknown> | null;

  return (
    <div
      className="planet-panel fade-in"
      style={{
        position: "absolute",
        left: "50%",
        top: "18%",
        transform: "translateX(-50%)",
        width: 340,
        maxWidth: "80vw",
        padding: "1rem",
        zIndex: 15,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>
          {String(locale === "ar" ? region.name : region.nameEn ?? region.name)}
        </strong>
        <button className="planet-btn planet-btn-ghost" onClick={() => selectRegion(null)}>
          ✕
        </button>
      </div>
      <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: "0.85rem" }}>
        <Row label="Biome" value={String(region.biome)} />
        <Row label="Temp" value={Number(region.temperature ?? 0).toFixed(2)} />
        <Row label="Moisture" value={Number(region.moisture ?? 0).toFixed(2)} />
        <Row label="Fertility" value={Number(region.fertility ?? 0).toFixed(2)} />
        <Row label="Pollution" value={Number(region.pollution ?? 0).toFixed(2)} />
        <Row label="Population" value={String(region.population)} />
        <Row label="Capacity" value={String(region.carryingCapacity)} />
        {civ && (
          <Row
            label={locale === "ar" ? "حضارة" : "Civilization"}
            value={String(locale === "ar" ? civ.name : civ.nameEn ?? civ.name)}
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--planet-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
