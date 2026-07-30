"use client";

import { messages } from "@/i18n/messages";
import { useSession } from "@/stores/session";
import { useWorldUi } from "@/stores/world-ui";

const categories = [
  { key: "creature", ar: "مخلوق", en: "Creature", color: "#38bdf8" },
  { key: "plant", ar: "نبات", en: "Plant", color: "#34d399" },
  { key: "resource", ar: "مورد", en: "Resource", color: "#fbbf24" },
  { key: "civilization", ar: "حضارة", en: "Civilization", color: "#f59e0b" },
  { key: "invention", ar: "اختراع", en: "Invention", color: "#22d3ee" },
  { key: "climate", ar: "ظاهرة", en: "Phenomenon", color: "#fb923c" },
] as const;

export function RightPanel({
  impact,
  onWhatIf,
}: {
  impact: {
    elementsAdded: number;
    totalChanges: number;
    evolutionDays: number;
  };
  onWhatIf: () => void;
}) {
  const locale = useSession((s) => s.locale);
  const t = messages[locale];
  const setAddOpen = useWorldUi((s) => s.setAddOpen);

  return (
    <aside
      className="planet-panel fade-in"
      style={{
        width: 300,
        maxWidth: "34vw",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>{t.addElement}</h2>
        <button
          className="planet-btn planet-btn-primary pulse-glow"
          style={{ width: "100%", fontSize: "1.4rem", padding: "1rem" }}
          onClick={() => setAddOpen(true)}
        >
          +
        </button>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
            marginTop: "0.85rem",
          }}
        >
          {categories.map((c) => (
            <button
              key={c.key}
              className="planet-btn planet-btn-ghost"
              style={{ fontSize: "0.72rem", borderColor: `${c.color}55`, color: c.color }}
              onClick={() => setAddOpen(true)}
            >
              {locale === "ar" ? c.ar : c.en}
            </button>
          ))}
        </div>
      </div>

      <button className="planet-btn planet-btn-primary" onClick={onWhatIf}>
        {t.whatIf}
      </button>

      <div>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>{t.yourImpact}</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.5rem",
          }}
        >
          <Metric value={impact.elementsAdded} label={t.elementsAdded} color="#22d3ee" />
          <Metric value={impact.totalChanges} label={t.totalChanges} color="#a78bfa" />
          <Metric value={impact.evolutionDays} label={t.evolutionDays} color="#34d399" />
        </div>
      </div>
    </aside>
  );
}

function Metric({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--planet-muted)" }}>{label}</div>
    </div>
  );
}
