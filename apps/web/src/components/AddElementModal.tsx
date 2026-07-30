"use client";

import { useMemo, useState } from "react";
import { CONTRIBUTION_CATEGORIES } from "@planet/config";
import { api } from "@/lib/api";
import { messages } from "@/i18n/messages";
import { useSession } from "@/stores/session";
import { useWorldUi } from "@/stores/world-ui";

export function AddElementModal({
  onApplied,
}: {
  onApplied: () => void;
}) {
  const open = useWorldUi((s) => s.addOpen);
  const setAddOpen = useWorldUi((s) => s.setAddOpen);
  const planetId = useWorldUi((s) => s.planetId);
  const selectedRegionId = useWorldUi((s) => s.selectedRegionId);
  const { token, locale } = useSession();
  const t = messages[locale];

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<(typeof CONTRIBUTION_CATEGORIES)[number]>("plant");
  const [idea, setIdea] = useState("شجرة عملاقة تمتص التلوث وتضيء في الليل");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [regionId, setRegionId] = useState<string | null>(selectedRegionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const categories = useMemo(
    () =>
      CONTRIBUTION_CATEGORIES.filter((c) =>
        [
          "creature",
          "plant",
          "resource",
          "civilization",
          "invention",
          "climate",
          "disease",
          "culture",
          "natural_law",
          "custom",
        ].includes(c),
      ),
    [],
  );

  if (!open) return null;

  async function analyze() {
    if (!token) {
      setError(locale === "ar" ? "يلزم تسجيل الدخول" : "Login required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyze(token, { category, idea, locale });
      setPreview(res);
      const regions = (res.suitableRegions as Array<{ id: string }>) ?? [];
      setRegionId(selectedRegionId ?? regions[0]?.id ?? null);
      setStep(2);
    } catch (e) {
      setError(locale === "ar" ? "فشل التحليل" : "Analyze failed");
      void e;
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!token || !planetId || !regionId || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.apply(token, {
        planetId,
        category,
        idea,
        regionId,
        structured: preview.structured,
        runHorizons: [1, 10, 100],
      });
      setResult(res);
      setStep(3);
      onApplied();
    } catch (e) {
      setError(locale === "ar" ? "فشل الإضافة" : "Apply failed");
      void e;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,14,0.75)",
        display: "grid",
        placeItems: "center",
        zIndex: 60,
        padding: "1rem",
      }}
      onClick={() => setAddOpen(false)}
    >
      <div
        className="planet-panel"
        style={{
          width: 720,
          maxWidth: "96vw",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <h2 style={{ margin: 0 }}>{t.addElement}</h2>
          <button className="planet-btn planet-btn-ghost" onClick={() => setAddOpen(false)}>
            ✕
          </button>
        </div>
        <p style={{ color: "var(--planet-muted)", fontSize: "0.85rem" }}>{t.sandboxNote}</p>

        {step === 1 && (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <label>{t.selectCategory}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {categories.map((c) => (
                <button
                  key={c}
                  className={`planet-btn ${category === c ? "planet-btn-primary" : "planet-btn-ghost"}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={5}
              placeholder={t.ideaPlaceholder}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--planet-border)",
                background: "rgba(15,23,42,0.85)",
                color: "var(--planet-text)",
                padding: "0.8rem",
              }}
            />
            {error && <div style={{ color: "var(--planet-red)" }}>{error}</div>}
            <button className="planet-btn planet-btn-primary" disabled={loading} onClick={analyze}>
              {loading ? "..." : t.analyze}
            </button>
          </div>
        )}

        {step === 2 && preview && (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div>
              <strong>
                {(preview.structured as { name?: string })?.name}
              </strong>
              {(preview.sandbox as boolean) && (
                <span style={{ marginInlineStart: 8, color: "var(--planet-gold)", fontSize: "0.8rem" }}>
                  AI: {(preview.provider as string) ?? "mock"} (sandbox)
                </span>
              )}
            </div>
            <pre
              style={{
                background: "rgba(15,23,42,0.9)",
                padding: "0.75rem",
                borderRadius: 12,
                overflow: "auto",
                fontSize: "0.75rem",
              }}
            >
              {JSON.stringify(preview.structured, null, 2)}
            </pre>
            <div>
              <div style={{ marginBottom: 6 }}>{t.selectRegion}</div>
              <select
                value={regionId ?? ""}
                onChange={(e) => setRegionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem",
                  borderRadius: 10,
                  background: "#0f172a",
                  color: "white",
                  border: "1px solid var(--planet-border)",
                }}
              >
                {((preview.suitableRegions as Array<Record<string, unknown>>) ?? []).map((r) => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {String(locale === "ar" ? r.name : r.nameEn)} · {String(r.biome)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ color: "var(--planet-muted)", fontSize: "0.85rem" }}>
              {String(preview.narrative ?? "")}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="planet-btn planet-btn-ghost" onClick={() => setStep(1)}>
                ←
              </button>
              <button
                className="planet-btn planet-btn-primary"
                disabled={loading || !regionId}
                onClick={apply}
              >
                {loading ? "..." : t.confirmAdd}
              </button>
            </div>
            {error && <div style={{ color: "var(--planet-red)" }}>{error}</div>}
          </div>
        )}

        {step === 3 && result && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0, color: "var(--planet-green)" }}>
              {locale === "ar" ? "تمت الإضافة إلى العالم" : "Added to the world"}
            </h3>
            <div>{String(result.narrative ?? "")}</div>
            <pre
              style={{
                background: "rgba(15,23,42,0.9)",
                padding: "0.75rem",
                borderRadius: 12,
                overflow: "auto",
                fontSize: "0.75rem",
              }}
            >
              {JSON.stringify(
                {
                  contributionId: result.contributionId,
                  successProbability: result.successProbability,
                  causalGraph: result.causalGraph,
                  effects: result.effects,
                },
                null,
                2,
              )}
            </pre>
            <button
              className="planet-btn planet-btn-primary"
              onClick={() => {
                setAddOpen(false);
                setStep(1);
                setResult(null);
                setPreview(null);
              }}
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
