"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";

const CATEGORIES = [
  ["plant", "plant"],
  ["creature", "creature"],
  ["resource", "resource"],
  ["civilization", "civilization"],
  ["invention", "invention"],
  ["climate_phenomenon", "natural"],
  ["disease", "disease"],
  ["culture", "culture"],
  ["natural_law", "law"],
  ["custom", "custom"],
] as const;

export function ContributionPanel({
  stats,
  selectedRegionId,
  onApplied,
}: {
  stats?: { elementsAdded: number; totalImpacts: number; impactAgeDays: number } | null;
  selectedRegionId: string | null;
  onApplied: (result: unknown) => void;
}) {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const setLastComparison = useAppStore((s) => s.setLastComparison);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("plant");
  const [idea, setIdea] = useState(
    "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل.",
  );
  const [step, setStep] = useState<"idea" | "preview" | "done">("idea");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{
    analysisId: string;
    structured: {
      nameAr: string;
      name: string;
      traits: Record<string, number>;
      risks: string[];
      benefits: string[];
      wasBalanced: boolean;
      balanceNotes: string[];
    };
    preview: {
      successProbability: number;
      environmentalImpact: number;
      economicImpact: number;
      shortTermEffects: string[];
      longTermEffects: string[];
    };
    suggestedRegionId: string;
    sandbox: boolean;
  } | null>(null);
  const [result, setResult] = useState<{
    narrativeAr: string;
    narrative: string;
    scenarios?: Array<{ horizonYears: number; label: string; summaryAr: string; probability: number }>;
    comparison?: { before: Record<string, number>; after: Record<string, number> };
    sandboxNarrative?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!user) {
      setError(locale === "ar" ? "يلزم تسجيل الدخول" : "Login required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<typeof analysis & object>("/contributions/analyze", {
        method: "POST",
        body: JSON.stringify({
          category,
          idea,
          locale,
          regionId: selectedRegionId ?? undefined,
        }),
      });
      setAnalysis(data as NonNullable<typeof analysis>);
      setStep("preview");
    } catch (e) {
      setError(locale === "ar" ? "فشل التحليل" : "Analysis failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<NonNullable<typeof result>>("/contributions/confirm", {
        method: "POST",
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          regionId: selectedRegionId ?? analysis.suggestedRegionId,
          runForecast: true,
        }),
      });
      setResult(data);
      if (data.comparison) setLastComparison(data.comparison);
      setStep("done");
      onApplied(data);
    } catch (e) {
      setError(locale === "ar" ? "فشل التأكيد" : "Confirm failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="panel contribution-panel pb-panel">
      <h2>{t(locale, "addElement")}</h2>
      <div className="category-grid">
        {CATEGORIES.map(([value, key]) => (
          <button
            key={value}
            className={category === value ? "cat active" : "cat"}
            onClick={() => setCategory(value)}
          >
            {t(locale, key)}
          </button>
        ))}
      </div>

      {step === "idea" && (
        <>
          <label>{t(locale, "writeIdea")}</label>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} />
          <button className="pb-btn pb-btn-primary" disabled={loading} onClick={analyze}>
            {loading ? t(locale, "loading") : t(locale, "analyze")}
          </button>
        </>
      )}

      {step === "preview" && analysis && (
        <div className="preview-block">
          {analysis.sandbox && <div className="sandbox-badge">{t(locale, "sandboxAi")}</div>}
          <h3>{locale === "ar" ? analysis.structured.nameAr : analysis.structured.name}</h3>
          <div className="trait-grid">
            {Object.entries(analysis.structured.traits)
              .filter(([, v]) => typeof v === "number" && v > 0.05)
              .slice(0, 8)
              .map(([k, v]) => (
                <div key={k} className="trait">
                  <span>{k}</span>
                  <b>{Math.round((v as number) * 100)}%</b>
                </div>
              ))}
          </div>
          <p>
            {locale === "ar" ? "احتمال النجاح" : "Success"}:{" "}
            {Math.round(analysis.preview.successProbability * 100)}%
          </p>
          <p>
            {locale === "ar" ? "أثر بيئي" : "Env impact"}: {analysis.preview.environmentalImpact}
          </p>
          <ul>
            {analysis.structured.risks.map((r) => (
              <li key={r}>⚠ {r}</li>
            ))}
          </ul>
          {analysis.structured.wasBalanced && (
            <p className="balanced">{analysis.structured.balanceNotes.join(" · ")}</p>
          )}
          <p className="hint">
            {t(locale, "chooseRegion")}: {selectedRegionId ?? analysis.suggestedRegionId}
          </p>
          <button className="pb-btn pb-btn-primary" disabled={loading} onClick={confirm}>
            {loading ? t(locale, "loading") : t(locale, "confirmAdd")}
          </button>
          <button className="pb-btn" onClick={() => setStep("idea")}>
            ←
          </button>
        </div>
      )}

      {step === "done" && result && (
        <div className="result-block">
          <h3>{t(locale, "seeWorldChange")}</h3>
          <p>{locale === "ar" ? result.narrativeAr : result.narrative}</p>
          {result.sandboxNarrative && <div className="sandbox-badge">{t(locale, "sandboxAi")}</div>}
          {result.scenarios && (
            <div className="scenarios">
              <h4>{t(locale, "whatHappens")}</h4>
              {result.scenarios
                .filter((s) => s.label === "most_likely")
                .map((s) => (
                  <div key={`${s.horizonYears}-${s.label}`} className="scenario">
                    <b>
                      {s.horizonYears}y · {Math.round(s.probability * 100)}%
                    </b>
                    <p>{s.summaryAr}</p>
                  </div>
                ))}
            </div>
          )}
          {result.comparison && (
            <div className="compare">
              <h4>{t(locale, "compare")}</h4>
              <pre>
                {JSON.stringify(
                  {
                    pollution: [
                      result.comparison.before.globalPollution,
                      result.comparison.after.globalPollution,
                    ],
                    stability: [
                      result.comparison.before.globalStability,
                      result.comparison.after.globalStability,
                    ],
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
          <button
            className="pb-btn"
            onClick={() => {
              setStep("idea");
              setResult(null);
              setAnalysis(null);
            }}
          >
            +
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="impact-stats">
        <h3>{t(locale, "yourImpact")}</h3>
        <div className="stat-row">
          <span>{t(locale, "elementsAdded")}</span>
          <b>{stats?.elementsAdded ?? 0}</b>
        </div>
        <div className="stat-row">
          <span>{t(locale, "totalImpacts")}</span>
          <b>{stats?.totalImpacts ?? 0}</b>
        </div>
        <div className="stat-row">
          <span>{t(locale, "evolutionTime")}</span>
          <b>
            {stats?.impactAgeDays ?? 0} {t(locale, "days")}
          </b>
        </div>
      </div>
    </aside>
  );
}
