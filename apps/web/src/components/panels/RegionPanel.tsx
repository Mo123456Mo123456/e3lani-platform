"use client";

/** Region inspector — opens when the user clicks the planet. */
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api, type RegionDetail } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function RegionPanel() {
  const { t, locale } = useI18n();
  const selectedCell = useAppStore((s) => s.selectedCell);
  const setSelectedCell = useAppStore((s) => s.setSelectedCell);
  const planetConfig = useAppStore((s) => s.planetConfig);
  const [detail, setDetail] = useState<RegionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCell === null || !planetConfig) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .region(planetConfig.planetId, selectedCell)
      .then((res) => !cancelled && setDetail(res))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "failed"));
    return () => {
      cancelled = true;
    };
  }, [selectedCell, planetConfig]);

  if (selectedCell === null) return null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="panel region-panel">
      <div className="wizard-header">
        <h2 className="panel-title">
          {t.region.title} #{selectedCell}
        </h2>
        <button className="close-btn" onClick={() => setSelectedCell(null)}>✕</button>
      </div>
      {!detail && !error && <p>{t.common.loading}</p>}
      {error && <p className="error-line">{error}</p>}
      {detail && (
        <div className="region-body">
          <div className="region-grid">
            <span>{t.region.biome}</span><b>{detail.cell.biome}</b>
            <span>{t.region.temperature}</span><b>{pct(detail.cell.temperature)}</b>
            <span>{t.region.moisture}</span><b>{pct(detail.cell.moisture)}</b>
            <span>{t.region.fertility}</span><b>{pct(detail.cell.fertility)}</b>
            <span>{t.region.pollution}</span><b>{pct(detail.cell.pollution)}</b>
            <span>{t.region.owner}</span>
            <b style={detail.owner ? { color: detail.owner.color } : undefined}>
              {detail.owner ? detail.owner.name : t.region.unclaimed}
            </b>
          </div>

          {detail.cities.length > 0 && (
            <section>
              <h4>{t.region.cities}</h4>
              {detail.cities.map((c) => <p key={c.id}>🏙 {c.name} — {c.population}</p>)}
            </section>
          )}
          {detail.species.length > 0 && (
            <section>
              <h4>{t.region.species}</h4>
              {detail.species.map((s) => <p key={s.id}>🐾 {s.name} ({s.diet}) — {s.population}</p>)}
            </section>
          )}
          {detail.plants.length > 0 && (
            <section>
              <h4>{t.region.plants}</h4>
              {detail.plants.map((p) => <p key={p.id}>🌿 {p.name} — {pct(p.coverage ?? 0)}</p>)}
            </section>
          )}
          {detail.cell.resources.length > 0 && (
            <section>
              <h4>{t.region.resources}</h4>
              {detail.cell.resources.map((r) => (
                <p key={r.id}>⛏ {r.type} — {Math.round(r.quantity)} {r.discovered ? "" : `(${locale === "ar" ? "غير مكتشف" : "undiscovered"})`}</p>
              ))}
            </section>
          )}
          {detail.recentEvents.length > 0 && (
            <section>
              <h4>{t.region.recentEvents}</h4>
              {detail.recentEvents.map((e) => (
                <p key={e.id} className="region-event">{e.type} · {t.common.year} {e.year}</p>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
