"use client";

/** Civilizations modal — civs, cities, wars, alliances from live state. */
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { StateSummary } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function CivsModal({ summary }: { summary: StateSummary | null }) {
  const { t } = useI18n();
  const open = useAppStore((s) => s.civsModalOpen);
  const setOpen = useAppStore((s) => s.setCivsModalOpen);
  const [tab, setTab] = useState<"civs" | "cities" | "wars" | "alliances">("civs");

  if (!open) return null;

  const civName = (id: string) => summary?.civilizations.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2 className="panel-title">{t.civs.title}</h2>
          <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="modal-tabs">
          {(["civs", "cities", "wars", "alliances"] as const).map((key) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {key === "civs" ? t.civs.tabCivs : key === "cities" ? t.civs.tabCities : key === "wars" ? t.civs.tabWars : t.civs.tabAlliances}
            </button>
          ))}
        </div>
        <div className="modal-body">
          {tab === "civs" && (
            <table className="data-table">
              <thead>
                <tr><th></th><th></th><th>{t.civs.population}</th><th>{t.civs.tech}</th><th>{t.civs.stability}</th></tr>
              </thead>
              <tbody>
                {(summary?.civilizations ?? []).map((civ) => (
                  <tr key={civ.id} className={civ.collapsed ? "collapsed" : ""}>
                    <td><span className="civ-dot" style={{ background: civ.color }} /></td>
                    <td>{civ.name} {civ.collapsed && <i>({t.civs.collapsed})</i>}</td>
                    <td>{civ.population.toLocaleString()}</td>
                    <td>{Math.round(civ.techLevel * 100)}%</td>
                    <td>{Math.round(civ.stability * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "cities" && (
            <table className="data-table">
              <tbody>
                {(summary?.cities ?? []).map((city) => (
                  <tr key={city.id}>
                    <td>🏙 {city.name}</td>
                    <td>{civName(city.civId)}</td>
                    <td>{city.population.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "wars" && (
            <>
              {(summary?.activeWars.length ?? 0) === 0 && <p>{t.civs.noWars}</p>}
              {(summary?.activeWars ?? []).map((war) => (
                <div key={war.id} className="war-card">
                  <p>⚔ {civName(war.attackerCivId)} × {civName(war.defenderCivId)}</p>
                  <p className="war-meta">
                    {t.civs.casualties}: {war.casualties.toLocaleString()} · {war.cause}
                  </p>
                </div>
              ))}
            </>
          )}
          {tab === "alliances" && (
            <>
              {(summary?.alliances.length ?? 0) === 0 && <p>{t.civs.noAlliances}</p>}
              {(summary?.alliances ?? []).map((ally) => (
                <div key={ally.id} className="war-card">
                  <p>🤝 {ally.memberCivIds.map(civName).join(" + ")}</p>
                  <p className="war-meta">{ally.reason}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
