"use client";

import { messages } from "@/i18n/messages";
import { useSession } from "@/stores/session";
import { useWorldUi } from "@/stores/world-ui";

export function Timeline({
  items,
}: {
  items: Array<Record<string, unknown>>;
}) {
  const locale = useSession((s) => s.locale);
  const t = messages[locale];
  const { playing, setPlaying } = useWorldUi();

  return (
    <footer
      className="planet-panel fade-in"
      style={{
        margin: "0 1rem 0.75rem",
        padding: "0.75rem 1rem",
        display: "grid",
        gridTemplateRows: "auto auto auto",
        gap: "0.55rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{t.timeline}</strong>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button className="planet-btn planet-btn-ghost" onClick={() => setPlaying(false)}>
            ⏮
          </button>
          <button className="planet-btn planet-btn-ghost" onClick={() => setPlaying(!playing)}>
            {playing ? "⏸" : "▶"}
          </button>
          <button className="planet-btn planet-btn-ghost" onClick={() => setPlaying(true)}>
            ⏭
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.65rem",
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {items.slice(-14).map((item) => {
          const title = String(locale === "ar" ? item.title : item.titleEn ?? item.title);
          const live = Boolean(item.isLive);
          return (
            <div
              key={String(item.id)}
              style={{
                minWidth: 140,
                padding: "0.55rem 0.7rem",
                borderRadius: 12,
                border: `1px solid ${live ? "rgba(248,113,113,0.5)" : "var(--planet-border)"}`,
                background: live
                  ? "linear-gradient(160deg, rgba(127,29,29,0.35), rgba(8,18,36,0.8))"
                  : "rgba(15,23,42,0.55)",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--planet-muted)" }}>
                Y{String(item.year)} {live ? `· ${t.live}` : ""}
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: 4 }}>{title}</div>
            </div>
          );
        })}
      </div>
      <div style={{ overflow: "hidden", color: "var(--planet-muted)", fontSize: "0.78rem" }}>
        <div className="ticker">{t.ticker} — {t.ticker}</div>
      </div>
    </footer>
  );
}
