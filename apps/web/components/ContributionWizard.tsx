"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Atom,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Dna,
  Droplets,
  FlaskConical,
  Flower2,
  Globe2,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AnalyzedContribution,
  ContributionCategory,
  ScenarioOutcome,
  WorldOverview,
} from "@living-planet/shared-types";
import {
  analyzeContribution,
  commitContribution,
  projectScenarios,
} from "@/lib/api";
import { useWorldUi } from "@/lib/world-store";

const categories: {
  id: ContributionCategory;
  ar: string;
  en: string;
  icon: typeof Dna;
}[] = [
  { id: "creature", ar: "مخلوق", en: "Creature", icon: Dna },
  { id: "plant", ar: "نبات", en: "Plant", icon: Flower2 },
  { id: "resource", ar: "مورد", en: "Resource", icon: Droplets },
  { id: "civilization", ar: "حضارة", en: "Civilization", icon: Globe2 },
  { id: "invention", ar: "اختراع", en: "Invention", icon: Atom },
  { id: "natural_phenomenon", ar: "ظاهرة", en: "Phenomenon", icon: Sparkles },
  { id: "disease", ar: "مرض", en: "Disease", icon: FlaskConical },
  { id: "custom", ar: "عنصر مخصص", en: "Custom", icon: Bot },
];

export function ContributionWizard({ overview }: { overview: WorldOverview }) {
  const locale = useWorldUi((state) => state.locale);
  const open = useWorldUi((state) => state.contributionOpen);
  const setOpen = useWorldUi((state) => state.setContributionOpen);
  const globallySelectedRegionId = useWorldUi((state) => state.selectedRegionId);
  const selectRegion = useWorldUi((state) => state.selectRegion);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ContributionCategory>("plant");
  const [idea, setIdea] = useState(
    "شجرة عملاقة تمتص التلوث وتخزن الطاقة الشمسية وتضيء بلطف في الليل",
  );
  const [analysis, setAnalysis] = useState<AnalyzedContribution>();
  const [regionId, setRegionId] = useState(globallySelectedRegionId ?? "");
  const [scenarios, setScenarios] = useState<ScenarioOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [completedId, setCompletedId] = useState<string>();

  const compatibleRegions = useMemo(
    () =>
      analysis
        ? overview.regions.filter((region) => analysis.possibleBiomes.includes(region.biome))
        : overview.regions.filter((region) => region.biome !== "ocean"),
    [analysis, overview.regions],
  );

  if (!open) return null;
  const isArabic = locale === "ar";
  const close = () => {
    if (!busy) setOpen(false);
  };

  const runAnalysis = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await analyzeContribution({ category, idea, locale });
      setAnalysis(result);
      const preferred = overview.regions.find(
        (region) =>
          region.id === globallySelectedRegionId &&
          result.possibleBiomes.includes(region.biome),
      );
      const firstCompatible = overview.regions.find((region) =>
        result.possibleBiomes.includes(region.biome),
      );
      const nextRegionId = preferred?.id ?? firstCompatible?.id ?? overview.regions[0]!.id;
      setRegionId(nextRegionId);
      selectRegion(nextRegionId);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ANALYSIS_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const runProjection = async () => {
    if (!analysis || !regionId) return;
    setBusy(true);
    setError(undefined);
    try {
      setScenarios(await projectScenarios(analysis, regionId));
      selectRegion(regionId);
      setStep(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PROJECTION_FAILED");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!analysis || !regionId) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await commitContribution(
        analysis,
        regionId,
        overview.planet.version,
      );
      setCompletedId(result.contributionId);
      setStep(4);
      await queryClient.invalidateQueries({ queryKey: ["world-overview"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "COMMIT_FAILED");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="wizard-shell">
        <header className="wizard-header">
          <div>
            <span className="eyebrow">
              {isArabic ? "مختبر المساهمات السببية" : "Causal contribution lab"}
            </span>
            <h2>
              {step === 4
                ? isArabic
                  ? "بدأ الأثر"
                  : "Impact started"
                : isArabic
                  ? "أضف عنصرًا واحدًا إلى العالم"
                  : "Add one element to the world"}
            </h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="إغلاق">
            <X size={20} />
          </button>
        </header>

        <div className="wizard-steps" aria-label="خطوات الإضافة">
          {[1, 2, 3, 4].map((value) => (
            <span key={value} className={value <= step ? "active" : ""}>
              {value}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="wizard-content">
            <p className="muted">
              {isArabic
                ? "يحوّل المحلل فكرتك إلى خصائص رقمية، ثم يوازنها قبل وصولها إلى المحاكاة."
                : "The analyzer structures and balances your idea before simulation."}
            </p>
            <div className="category-grid">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={category === item.id ? "category active" : "category"}
                    onClick={() => setCategory(item.id)}
                  >
                    <Icon size={19} />
                    <span>{isArabic ? item.ar : item.en}</span>
                  </button>
                );
              })}
            </div>
            <label className="field-label" htmlFor="contribution-idea">
              {isArabic ? "صف فكرتك" : "Describe your idea"}
            </label>
            <textarea
              id="contribution-idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              minLength={10}
              maxLength={1200}
              rows={5}
            />
            <div className="input-meta">
              <span>{idea.length}/1200</span>
              <span>
                <ShieldAlert size={14} />
                {isArabic ? "فحص إساءة وحقن تلقائي" : "Automatic safety screening"}
              </span>
            </div>
          </div>
        )}

        {step === 2 && analysis && (
          <div className="wizard-content analysis-view">
            <div className="analysis-title">
              <div className="analysis-orb">
                <Sparkles size={24} />
              </div>
              <div>
                <span className="eyebrow">
                  {analysis.provider === "sandbox"
                    ? isArabic
                      ? "محلل Sandbox — معلن بوضوح"
                      : "Explicit Sandbox analyzer"
                    : analysis.provider}
                </span>
                <h3>{analysis.name}</h3>
              </div>
              <span className="score">{Math.round(analysis.balanceScore * 100)}%</span>
            </div>
            {analysis.wasBalanced && (
              <div className="balance-note">
                <ShieldAlert size={17} />
                {isArabic
                  ? "عُدّلت الخصائص الخارقة إلى حدود قابلة للمحاكاة."
                  : "Overpowered traits were constrained to simulatable limits."}
              </div>
            )}
            <div className="trait-grid">
              {Object.entries(analysis.traits).map(([name, value]) => (
                <div className="trait" key={name}>
                  <div>
                    <span>{name}</span>
                    <b>{Math.round(value * 100)}</b>
                  </div>
                  <i style={{ width: `${value * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="risk-columns">
              <div>
                <h4>{isArabic ? "المزايا" : "Advantages"}</h4>
                {analysis.advantages.map((value) => (
                  <span className="positive-chip" key={value}>
                    {value}
                  </span>
                ))}
              </div>
              <div>
                <h4>{isArabic ? "المخاطر" : "Risks"}</h4>
                {analysis.risks.map((value) => (
                  <span className="risk-chip" key={value}>
                    {value}
                  </span>
                ))}
              </div>
            </div>
            <label className="field-label" htmlFor="start-region">
              {isArabic ? "منطقة الظهور الأولى" : "Starting region"}
            </label>
            <select
              id="start-region"
              value={regionId}
              onChange={(event) => {
                setRegionId(event.target.value);
                selectRegion(event.target.value);
              }}
            >
              {compatibleRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {isArabic ? region.nameAr : region.nameEn} — {region.biome}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 3 && analysis && (
          <div className="wizard-content scenario-view">
            <div className="scenario-heading">
              <div>
                <span className="eyebrow">
                  {isArabic ? "64 مسارًا حتمي البذرة" : "64 seeded paths"}
                </span>
                <h3>{isArabic ? "ماذا سيحدث بعد إضافتك؟" : "What happens next?"}</h3>
              </div>
              <span className="probability-label">
                {isArabic ? "نتائج احتمالية" : "Probabilistic"}
              </span>
            </div>
            <div className="scenario-list">
              {scenarios
                .filter((scenario) => scenario.scenario === "most_likely")
                .map((scenario) => (
                  <article key={scenario.horizonYears}>
                    <div className="scenario-year">
                      <span>+</span>
                      <b>{scenario.horizonYears}</b>
                      <small>{isArabic ? "سنة" : "years"}</small>
                    </div>
                    <div>
                      <strong>
                        {scenario.pollutionDelta < 0
                          ? isArabic
                            ? "انخفاض متوقع في التلوث"
                            : "Expected pollution decrease"
                          : isArabic
                            ? "ضغط بيئي محتمل"
                            : "Possible environmental pressure"}
                      </strong>
                      <p>
                        Δ {isArabic ? "التلوث" : "pollution"}{" "}
                        {(scenario.pollutionDelta * 100).toFixed(1)}% · Δ{" "}
                        {isArabic ? "التنوع" : "biodiversity"}{" "}
                        {(scenario.biodiversityDelta * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span>±{Math.round(scenario.uncertainty * 100)}%</span>
                  </article>
                ))}
            </div>
            <div className="causal-preview">
              <span>{analysis.name}</span>
              <ChevronLeft size={16} />
              <span>{isArabic ? "الماء والتربة" : "Water & soil"}</span>
              <ChevronLeft size={16} />
              <span>{isArabic ? "السكان والاقتصاد" : "Population & economy"}</span>
              <ChevronLeft size={16} />
              <span>{isArabic ? "أحداث بعيدة" : "Long-term events"}</span>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-content completed-view">
            <CheckCircle2 size={58} />
            <h3>{isArabic ? "دخل العنصر إلى أزورا" : "The element entered Azura"}</h3>
            <p>
              {isArabic
                ? "حُفظت الإضافة وحدثها السببي في سجل العالم. ستظهر آثارها اللاحقة فقط عندما تنتجها دورات المحاكاة."
                : "The contribution and its causal event are stored. Later effects appear only when simulation produces them."}
            </p>
            <code>{completedId}</code>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        <footer className="wizard-footer">
          {step > 1 && step < 4 && (
            <button className="secondary-button" onClick={() => setStep(step - 1)} disabled={busy}>
              {isArabic ? "السابق" : "Back"}
            </button>
          )}
          {step === 1 && (
            <button
              className="primary-button"
              onClick={runAnalysis}
              disabled={busy || idea.trim().length < 10}
            >
              {busy ? <LoaderCircle className="spin" size={18} /> : <Bot size={18} />}
              {isArabic ? "حلّل ووازن الفكرة" : "Analyze and balance"}
            </button>
          )}
          {step === 2 && (
            <button className="primary-button" onClick={runProjection} disabled={busy || !regionId}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
              {isArabic ? "شغّل السيناريوهات" : "Run scenarios"}
            </button>
          )}
          {step === 3 && (
            <button className="primary-button" onClick={commit} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
              {isArabic ? "أكّد الإضافة إلى العالم" : "Commit to world"}
            </button>
          )}
          {step === 4 && (
            <button className="primary-button" onClick={close}>
              {isArabic ? "تابع أثرها على الكوكب" : "Follow its impact"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
