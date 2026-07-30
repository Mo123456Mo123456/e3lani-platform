"use client";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";

export function RegionDrawer({
  data,
  onClose,
}: {
  data: {
    region: {
      name: string;
      nameAr: string;
      biome: string;
      temperature: number;
      moisture: number;
      fertility: number;
      pollution: number;
      population: number;
      lat: number;
      lon: number;
    };
    local: {
      civilizations: Array<{ name: string; nameAr: string; population: number }>;
      cities: Array<{ name: string; nameAr: string }>;
      resources: Array<{ name: string; nameAr: string }>;
    };
  } | null;
  onClose: () => void;
}) {
  const locale = useAppStore((s) => s.locale);
  if (!data) return null;
  const r = data.region;

  return (
    <div className="region-drawer pb-panel">
      <button className="close" onClick={onClose}>
        ×
      </button>
      <h3>{t(locale, "regionData")}</h3>
      <h2>{locale === "ar" ? r.nameAr : r.name}</h2>
      <div className="biome">{r.biome}</div>
      <div className="metrics">
        <div>
          <span>T</span>
          <b>{Math.round(r.temperature * 100)}</b>
        </div>
        <div>
          <span>H2O</span>
          <b>{Math.round(r.moisture * 100)}</b>
        </div>
        <div>
          <span>Fert</span>
          <b>{Math.round(r.fertility * 100)}</b>
        </div>
        <div>
          <span>Pol</span>
          <b>{Math.round(r.pollution * 100)}</b>
        </div>
      </div>
      <p>
        {r.lat.toFixed(1)}°, {r.lon.toFixed(1)}° · pop {r.population.toLocaleString()}
      </p>
      <h4>{t(locale, "civilizations")}</h4>
      <ul>
        {data.local.civilizations.map((c) => (
          <li key={c.name}>{locale === "ar" ? c.nameAr : c.name}</li>
        ))}
      </ul>
      <h4>{t(locale, "resources")}</h4>
      <ul>
        {data.local.resources.slice(0, 5).map((c) => (
          <li key={c.name}>{locale === "ar" ? c.nameAr : c.name}</li>
        ))}
      </ul>
    </div>
  );
}
