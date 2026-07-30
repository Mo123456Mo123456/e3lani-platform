"use client";

import { messages } from "@/i18n/messages";
import { useSession } from "@/stores/session";

const TYPE_COLOR: Record<string, string> = {
  SPECIES_CREATED: "#38bdf8",
  SPECIES_EXTINCT: "#f87171",
  CIVILIZATION_FOUNDED: "#fbbf24",
  TECHNOLOGY_DISCOVERED: "#22d3ee",
  WAR_STARTED: "#f87171",
  WAR_ENDED: "#fb923c",
  MIGRATION_STARTED: "#a78bfa",
  CLIMATE_CHANGED: "#34d399",
  USER_CONTRIBUTION_APPLIED: "#67e8f9",
  PLANT_SPREAD: "#34d399",
  ALLIANCE_CREATED: "#c4b5fd",
  TRADE_ROUTE_CREATED: "#fbbf24",
  VOLCANO_ERUPTED: "#fb923c",
};

export function EventLog({
  events,
}: {
  events: Array<Record<string, unknown>>;
}) {
  const locale = useSession((s) => s.locale);
  const t = messages[locale];

  return (
    <aside
      className="planet-panel fade-in"
      style={{
        width: 300,
        maxWidth: "34vw",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxHeight: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>{t.eventLog}</h2>
        <span style={{ color: "var(--planet-cyan)", fontSize: "0.75rem" }}>● LIVE</span>
      </div>
      <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {events.map((e) => {
          const type = String(e.type ?? "");
          const title = String(locale === "ar" ? e.title ?? e.titleEn : e.titleEn ?? e.title);
          const summary = String(
            locale === "ar" ? e.summary ?? e.summaryEn : e.summaryEn ?? e.summary,
          );
          return (
            <article
              key={String(e.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr",
                gap: "0.65rem",
                padding: "0.65rem 0.5rem",
                borderBottom: "1px solid rgba(148,163,184,0.12)",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  marginTop: 6,
                  borderRadius: "50%",
                  background: TYPE_COLOR[type] ?? "#94a3b8",
                  boxShadow: `0 0 10px ${TYPE_COLOR[type] ?? "#94a3b8"}`,
                }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{title}</div>
                <div style={{ color: "var(--planet-muted)", fontSize: "0.75rem", marginTop: 2 }}>
                  {summary.slice(0, 90)}
                </div>
                <div style={{ color: "var(--planet-muted)", fontSize: "0.7rem", marginTop: 4 }}>
                  Y{String(e.year)} · {type}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <button className="planet-btn planet-btn-ghost">{t.viewAllEvents}</button>
    </aside>
  );
}
