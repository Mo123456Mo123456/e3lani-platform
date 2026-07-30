"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type {
  ContributionAnalysis,
  ContributionCategory,
  FutureScenario,
  PlanetRegion,
  WorldOverview,
} from "@planet/shared-types";
import { api, ApiError } from "@/lib/api";
import { useUiStore } from "@/lib/store";

interface AnalysisResponse {
  analysis: ContributionAnalysis;
  suggestedRegions: PlanetRegion[];
  scenarios: FutureScenario[];
  sandbox: boolean;
}

const categories: Array<[ContributionCategory, string]> = [
  ["creature", "مخلوق"],
  ["plant", "نبات"],
  ["resource", "مورد"],
  ["civilization", "حضارة"],
  ["invention", "اختراع"],
  ["natural_phenomenon", "ظاهرة"],
  ["disease", "مرض"],
  ["culture", "ثقافة"],
  ["world_law", "قانون عالمي"],
  ["custom", "مخصص"],
];

export function ContributionDialog({
  world,
  onClose,
}: {
  world: WorldOverview;
  onClose: () => void;
}) {
  const token = useUiStore((state) => state.accessToken);
  const locale = useUiStore((state) => state.locale);
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"idea" | "preview" | "placed">("idea");
  const [category, setCategory] = useState<ContributionCategory>("plant");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [regionId, setRegionId] = useState("");
  const [result, setResult] = useState<{ narrative: string; events: unknown[] } | null>(null);
  const [error, setError] = useState("");

  const analyze = useMutation({
    mutationFn: (idea: string) =>
      api<AnalysisResponse>("/v1/contributions/analyze", {
        method: "POST",
        token,
        body: JSON.stringify({ idea, locale, preferredCategory: category }),
      }),
    onSuccess: (data) => {
      setAnalysisResult(data);
      setRegionId(data.suggestedRegions[0]?.id ?? "");
      setStage("preview");
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.code : "ANALYSIS_FAILED"),
  });

  const commit = useMutation({
    mutationFn: () =>
      api<{ narrative: string; events: unknown[] }>("/v1/contributions", {
        method: "POST",
        token,
        body: JSON.stringify({
          analysis: analysisResult?.analysis,
          regionId,
          expectedVersion: world.state.version,
        }),
      }),
    onSuccess: async (data) => {
      setResult(data);
      setStage("placed");
      await queryClient.invalidateQueries({ queryKey: ["world"] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.code : "COMMIT_FAILED"),
  });

  const advance = useMutation({
    mutationFn: () =>
      api("/v1/world/ticks", { method: "POST", token, body: JSON.stringify({ count: 1 }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["world"] });
      onClose();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.code : "TICK_FAILED"),
  });

  const submitIdea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    analyze.mutate(String(new FormData(event.currentTarget).get("idea") ?? ""));
  };

  return (
    <div className="dialog-backdrop">
      <section className="dialog contribution-dialog" role="dialog" aria-modal="true" aria-labelledby="contribution-title">
        <button className="dialog-close" onClick={onClose} aria-label="إغلاق">×</button>
        <div className="stepper" aria-label="مراحل الإضافة">
          <span className={stage === "idea" ? "active" : "done"}>1 الفكرة</span>
          <span className={stage === "preview" ? "active" : stage === "placed" ? "done" : ""}>2 المحاكاة الأولية</span>
          <span className={stage === "placed" ? "active" : ""}>3 الأثر</span>
        </div>

        {stage === "idea" && (
          <>
            <p className="eyebrow">STRUCTURED CONTRIBUTION</p>
            <h2 id="contribution-title">ماذا ستضيف إلى هذا العالم؟</h2>
            <form onSubmit={submitIdea}>
              <div className="category-grid">
                {categories.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={category === value ? "category active" : "category"}
                    onClick={() => setCategory(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                صف الفكرة وخصائصها وقيودها
                <textarea
                  name="idea"
                  minLength={8}
                  maxLength={2_000}
                  required
                  defaultValue="شجرة عملاقة تمتص التلوث وتضيء في الليل، لكنها تحتاج إلى ماء كثير"
                />
              </label>
              <button className="primary-button" disabled={analyze.isPending}>
                {analyze.isPending ? "جارٍ التحليل والتحقق…" : "حلّل وشغّل السيناريوهات"}
              </button>
            </form>
          </>
        )}

        {stage === "preview" && analysisResult && (
          <>
            <div className="preview-heading">
              <div>
                <p className="eyebrow">CAUSAL PREVIEW</p>
                <h2>{analysisResult.analysis.name}</h2>
              </div>
              <span className={analysisResult.sandbox ? "sandbox-badge" : "provider-badge"}>
                {analysisResult.sandbox ? "Sandbox: قواعد حتمية" : analysisResult.analysis.provider}
              </span>
            </div>
            <p>{analysisResult.analysis.description}</p>
            {analysisResult.analysis.balancedChanges.length > 0 && (
              <div className="balance-notice">
                <strong>تعديلات التوازن</strong>
                {analysisResult.analysis.balancedChanges.map((change) => <span key={change}>{change}</span>)}
              </div>
            )}
            <div className="trait-grid">
              {Object.entries(analysisResult.analysis.traits).map(([name, value]) => (
                <div key={name} className="trait">
                  <span>{name}</span><strong>{Math.round(value * 100)}%</strong>
                  <i style={{ width: `${value * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="scenario-grid">
              {analysisResult.scenarios.map((scenario) => (
                <article key={scenario.horizonYears}>
                  <small>بعد</small>
                  <strong>{scenario.horizonYears} سنة</strong>
                  <span>انتشار {Math.round((scenario.likely.spread ?? 0) * 100)}%</span>
                  <span>عدم اليقين {Math.round(scenario.uncertainty * 100)}%</span>
                </article>
              ))}
            </div>
            <label>
              منطقة البداية
              <select value={regionId} onChange={(event) => setRegionId(event.target.value)}>
                {analysisResult.suggestedRegions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.biome} · {region.latitude.toFixed(1)}°, {region.longitude.toFixed(1)}°
                  </option>
                ))}
              </select>
            </label>
            <div className="risks">
              <strong>المخاطر:</strong>{" "}
              {analysisResult.analysis.risks.length
                ? analysisResult.analysis.risks.join(" · ")
                : "لا مخاطر عالية في المحاكاة الأولية"}
            </div>
            <button className="primary-button" onClick={() => commit.mutate()} disabled={commit.isPending || !regionId}>
              {commit.isPending ? "جارٍ الحفظ في سجل العالم…" : "تأكيد وإدخال العنصر"}
            </button>
          </>
        )}

        {stage === "placed" && result && (
          <div className="placed-result">
            <span className="success-orbit">✓</span>
            <p className="eyebrow">EVENT SOURCED</p>
            <h2>دخلت مساهمتك إلى العالم</h2>
            <p>{result.narrative}</p>
            <small>تم حفظ {result.events.length} حدث سببي. لن يذكر السرد حدثًا لم ينتجه المحرك.</small>
            <button className="primary-button" onClick={() => advance.mutate()} disabled={advance.isPending}>
              {advance.isPending ? "تتقدم المحاكاة…" : "شغّل أول سنة من تأثيرها"}
            </button>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
