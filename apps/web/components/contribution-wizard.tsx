"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Dna,
  FlaskConical,
  Leaf,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AnalyzedContribution,
  ContributionCategory,
  ContributionPreview,
  RegionSummary,
  WorldEvent,
} from "@living-planet/shared-types";
import { planetApi } from "@/lib/api";
import { useWorldStore } from "@/lib/store";

const categories: Array<{ value: ContributionCategory; ar: string; en: string; icon: typeof Leaf }> = [
  { value: "creature", ar: "مخلوق", en: "Creature", icon: Dna },
  { value: "plant", ar: "نبات", en: "Plant", icon: Leaf },
  { value: "resource", ar: "مورد", en: "Resource", icon: FlaskConical },
  { value: "civilization", ar: "حضارة", en: "Civilization", icon: Sparkles },
  { value: "invention", ar: "اختراع", en: "Invention", icon: FlaskConical },
  { value: "natural_phenomenon", ar: "ظاهرة طبيعية", en: "Natural phenomenon", icon: Sparkles },
  { value: "disease", ar: "مرض", en: "Disease", icon: Dna },
  { value: "culture", ar: "ثقافة", en: "Culture", icon: Sparkles },
  { value: "world_law", ar: "قانون عالمي", en: "World law", icon: Sparkles },
  { value: "custom", ar: "عنصر مخصص", en: "Custom", icon: Sparkles },
];

export function ContributionWizard({
  regions,
  onComplete,
}: {
  regions: RegionSummary[];
  onComplete(event: WorldEvent): void;
}) {
  const open = useWorldStore((state) => state.wizardOpen);
  const setOpen = useWorldStore((state) => state.setWizardOpen);
  const selectedRegion = useWorldStore((state) => state.selectedRegion);
  const locale = useWorldStore((state) => state.locale);
  const user = useWorldStore((state) => state.user);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<ContributionCategory>("plant");
  const [idea, setIdea] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzedContribution | null>(null);
  const [regionId, setRegionId] = useState("");
  const [preview, setPreview] = useState<ContributionPreview | null>(null);
  const [createdEvent, setCreatedEvent] = useState<WorldEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedRegion) setRegionId(selectedRegion.id);
    else if (!regionId && regions[0]) setRegionId(regions[0].id);
  }, [selectedRegion, regions, regionId]);

  if (!open) return null;
  const ar = locale === "ar";
  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(1);
      setAnalysis(null);
      setPreview(null);
      setCreatedEvent(null);
      setError("");
    }, 250);
  };

  const analyze = async () => {
    if (!user) {
      setError(ar ? "سجل الدخول أولًا لربط الإضافة بحسابك." : "Sign in first to link this contribution.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await planetApi.analyze(category, idea, locale);
      setAnalysis(result);
      setStep(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setPending(false);
    }
  };

  const simulate = async () => {
    if (!analysis || !regionId) return;
    setPending(true);
    setError("");
    try {
      setPreview(await planetApi.preview(regionId, analysis));
      setStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      setPending(false);
    }
  };

  const confirm = async () => {
    if (!analysis || !regionId) return;
    setPending(true);
    setError("");
    try {
      const result = await planetApi.confirm(regionId, analysis, idea, crypto.randomUUID());
      setCreatedEvent(result.event);
      setStep(5);
      onComplete(result.event);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contribution failed");
    } finally {
      setPending(false);
    }
  };

  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const NextIcon = ar ? ArrowLeft : ArrowRight;

  return (
    <div className="modal-backdrop">
      <section className="modal contribution-modal" role="dialog" aria-modal="true" aria-labelledby="contribution-title">
        <button className="icon-button modal-close" onClick={close} aria-label={ar ? "إغلاق" : "Close"}><X size={18} /></button>
        <header className="wizard-header">
          <div>
            <p className="eyebrow">{ar ? `الخطوة ${step} من 5` : `Step ${step} of 5`}</p>
            <h2 id="contribution-title">{ar ? "أضف عنصرًا واحدًا إلى العالم" : "Add one element to the world"}</h2>
          </div>
          <div className="step-track" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((value) => <span key={value} className={value <= step ? "active" : ""} />)}
          </div>
        </header>

        <div className="wizard-body">
          {step === 1 && (
            <>
              <h3>{ar ? "ما الذي تريد إدخاله إلى التاريخ؟" : "What will you introduce into history?"}</h3>
              <div className="category-grid">
                {categories.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      className={`category-choice ${category === item.value ? "selected" : ""}`}
                      onClick={() => setCategory(item.value)}
                    >
                      <Icon size={20} />
                      <span>{ar ? item.ar : item.en}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3>{ar ? "صف فكرتك بوضوح" : "Describe your idea clearly"}</h3>
              <textarea
                className="idea-input"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                minLength={12}
                maxLength={2000}
                placeholder={ar ? "مثال: شجرة عملاقة تمتص التلوث وتضيء في الليل…" : "Example: A giant tree that absorbs pollution and glows at night…"}
                autoFocus
              />
              <div className="input-meta">
                <span>{idea.length}/2000</span>
                <span className="disabled-feature" title={ar ? "التسجيل الصوتي غير مفعّل في هذه المرحلة" : "Voice input is not enabled in this phase"}>
                  {ar ? "الإدخال الصوتي — غير مفعّل" : "Voice input — unavailable"}
                </span>
              </div>
            </>
          )}

          {step === 3 && analysis && (
            <>
              <div className="analysis-title">
                <div>
                  <p className="eyebrow">{ar ? "نتيجة التحليل المنظم" : "Structured analysis"}</p>
                  <h3>{analysis.name}</h3>
                </div>
                <span className={`provider-badge ${analysis.sandbox ? "sandbox" : ""}`}>
                  {analysis.sandbox ? "Sandbox" : analysis.provider}
                </span>
              </div>
              <p className="analysis-description">{analysis.description}</p>
              <div className="trait-grid">
                {Object.entries(analysis.traits).map(([name, value]) => (
                  <div key={name} className="trait">
                    <div><span>{name}</span><b>{Math.round(value * 100)}%</b></div>
                    <i><span style={{ width: `${value * 100}%` }} /></i>
                  </div>
                ))}
              </div>
              {analysis.risks.length > 0 && (
                <div className="risk-box">
                  <AlertTriangle size={18} />
                  <div><b>{ar ? "مخاطر محسوبة" : "Calculated risks"}</b><p>{analysis.risks.join(" · ")}</p></div>
                </div>
              )}
              <label className="region-select">
                <span><MapPin size={16} /> {ar ? "منطقة الظهور الأولى" : "Starting region"}</span>
                <select value={regionId} onChange={(event) => setRegionId(event.target.value)}>
                  {regions.filter((region) => region.biome !== "ocean" && region.biome !== "ice").map((region) => (
                    <option key={region.id} value={region.id}>{region.name} — {region.biome}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {step === 4 && preview && (
            <>
              <div className="analysis-title">
                <div><p className="eyebrow">{ar ? "محاكاة Monte Carlo" : "Monte Carlo simulation"}</p><h3>{ar ? "ماذا سيحدث بعد إضافتك؟" : "What happens after your addition?"}</h3></div>
                <div className="probability-ring"><b>{Math.round(preview.successProbability * 100)}%</b><span>{ar ? "نجاح" : "success"}</span></div>
              </div>
              <div className="scenario-grid">
                {[
                  { title: ar ? "بعد 10 سنوات" : "After 10 years", data: preview.shortTerm },
                  { title: ar ? "بعد 1000 سنة" : "After 1,000 years", data: preview.longTerm },
                  { title: ar ? "أفضل مسار" : "Best path", data: preview.bestCase },
                  { title: ar ? "أسوأ مسار" : "Worst path", data: preview.worstCase },
                ].map(({ title, data }) => (
                  <article key={title} className="scenario-card">
                    <span>{title}</span>
                    <b>{Math.round(data.probability * 100)}%</b>
                    <small>{ar ? `ثقة ${Math.round(data.confidence * 100)}%` : `${Math.round(data.confidence * 100)}% confidence`}</small>
                    <p>{data.events[0]?.reason}</p>
                  </article>
                ))}
              </div>
              <div className="impact-bars">
                <span>{ar ? "التنوع الحيوي" : "Biodiversity"} <b>{preview.longTerm.metrics.biodiversityDelta > 0 ? "+" : ""}{preview.longTerm.metrics.biodiversityDelta}</b></span>
                <span>{ar ? "التلوث" : "Pollution"} <b>{preview.longTerm.metrics.pollutionDelta > 0 ? "+" : ""}{preview.longTerm.metrics.pollutionDelta}</b></span>
                <span>{ar ? "ضغط المياه" : "Water stress"} <b>+{preview.longTerm.metrics.waterStressDelta}</b></span>
              </div>
              <p className="uncertainty-note">
                {ar ? `هذه نتائج احتمالية وليست وعدًا. عدم اليقين: ${Math.round(preview.uncertainty * 100)}%.` : `These are probabilities, not guarantees. Uncertainty: ${Math.round(preview.uncertainty * 100)}%.`}
              </p>
            </>
          )}

          {step === 5 && createdEvent && (
            <div className="success-state">
              <div className="success-icon"><Check size={36} /></div>
              <p className="eyebrow">{ar ? "سُجّل في التاريخ" : "Recorded in history"}</p>
              <h3>{createdEvent.title}</h3>
              <p>{createdEvent.summary}</p>
              <div className="cause-card">
                <b>{ar ? "السبب المسجل" : "Recorded cause"}</b>
                <span>{createdEvent.cause}</span>
                <small>{ar ? `الثقة ${Math.round(createdEvent.confidence * 100)}%` : `${Math.round(createdEvent.confidence * 100)}% confidence`}</small>
              </div>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <footer className="wizard-actions">
          {step > 1 && step < 5 && (
            <button className="secondary-button" onClick={() => setStep(step - 1)} disabled={pending}>
              <BackIcon size={17} /> {ar ? "السابق" : "Back"}
            </button>
          )}
          <span />
          {step === 1 && <button className="primary-button" onClick={() => setStep(2)}>{ar ? "متابعة" : "Continue"} <NextIcon size={17} /></button>}
          {step === 2 && <button className="primary-button" onClick={analyze} disabled={pending || idea.trim().length < 12}>{pending ? (ar ? "جارٍ التحليل…" : "Analyzing…") : (ar ? "تحليل الفكرة" : "Analyze idea")} <Sparkles size={17} /></button>}
          {step === 3 && <button className="primary-button" onClick={simulate} disabled={pending || !regionId}>{pending ? (ar ? "تشغيل السيناريوهات…" : "Running scenarios…") : (ar ? "محاكاة التأثير" : "Simulate impact")} <NextIcon size={17} /></button>}
          {step === 4 && <button className="primary-button confirm" onClick={confirm} disabled={pending}>{pending ? (ar ? "جارٍ الإدخال…" : "Introducing…") : (ar ? "تأكيد وإدخال إلى العالم" : "Confirm and introduce")} <Check size={17} /></button>}
          {step === 5 && <button className="primary-button" onClick={close}>{ar ? "متابعة العالم" : "Continue exploring"}</button>}
        </footer>
      </section>
    </div>
  );
}
