"use client";

import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

const TYPE_COLOR: Record<string, string> = {
  SPECIES_CREATED: "var(--blue)",
  PLANT_CREATED: "var(--green)",
  CIVILIZATION_FOUNDED: "var(--gold)",
  TECHNOLOGY_DISCOVERED: "var(--cyan)",
  WAR_STARTED: "var(--red)",
  WAR_ENDED: "var(--orange)",
  MIGRATION_STARTED: "var(--purple)",
  CLIMATE_CHANGED: "var(--cyan)",
  DROUGHT: "var(--orange)",
  DISEASE_OUTBREAK: "var(--red)",
  TRADE_ROUTE_CREATED: "var(--gold)",
  USER_CONTRIBUTION: "var(--cyan)",
  ALLIANCE_CREATED: "var(--purple)",
  VOLCANO_ERUPTED: "var(--orange)",
  SPECIES_EXTINCT: "var(--red)",
};

export function EventLog() {
  const locale = useAppStore((s) => s.locale);
  const events = useAppStore((s) => s.events);
  const selectRegion = useAppStore((s) => s.selectRegion);
  const d = t(locale);

  return (
    <aside
      className="panel fade-in"
      style={{
        width: 300,
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "0.85rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <strong>{d.events}</strong>
        <span className="chip">
          <span className="live-dot" /> {events.length}
        </span>
      </div>
      <div className="scroll-y" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {events.length === 0 && (
          <div style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            {locale === "ar" ? "بانتظار نبضات العالم…" : "Waiting for world ticks…"}
          </div>
        )}
        {events.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => e.regionId && selectRegion(e.regionId)}
            style={{
              textAlign: "inherit",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0.55rem 0.65rem",
              color: "var(--text)",
              display: "grid",
              gridTemplateColumns: "10px 1fr",
              gap: "0.55rem",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                marginTop: 5,
                background: TYPE_COLOR[e.type] ?? "var(--text-dim)",
              }}
            />
            <span>
              <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                {locale === "ar" ? e.titleAr : e.title}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 2 }}>
                {(locale === "ar" ? e.descriptionAr : e.description).slice(0, 90)}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: 4 }}>
                Y{e.year} · T{e.tick} · {(e.importance * 100).toFixed(0)}%
              </div>
            </span>
          </button>
        ))}
      </div>
      <button className="btn" type="button" style={{ marginTop: "0.75rem" }}>
        {d.viewAllEvents}
      </button>
    </aside>
  );
}
