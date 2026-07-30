"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  ChevronLeft,
  Dna,
  FlaskConical,
  Landmark,
  Leaf,
  LoaderCircle,
  Mountain,
  PackageOpen,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ContributionAnalysis,
  ContributionCategory,
  PlanetRegion,
} from "@planet/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  analyzeContribution,
  commitContribution,
  runTicks,
} from "@/lib/api";
import { useWorldStore } from "@/lib/world-store";

const categories: Array<{
  id: ContributionCategory;
  label: string;
  icon: typeof Leaf;
}> = [
  { id: "creature", label: "مخلوق", icon: Dna },
  { id: "plant", label: "نبات", icon: Leaf },
  { id: "resource", label: "مورد", icon: PackageOpen },
  { id: "civilization", label: "حضارة", icon: Landmark },
  { id: "invention", label: "اختراع", icon: FlaskConical },
  { id: "natural_phenomenon", label: "ظاهرة", icon: Mountain },
  { id: "disease", label: "مرض", icon: Activity },
  { id: "custom", label: "مخصص", icon: Sparkles },
];

export function ContributionFlow({
  worldId,
  regions,
}: {
  worldId: string;
  regions: PlanetRegion[];
}) {
  const open = useWorldStore((state) => state.contributionOpen);
  const setOpen = useWorldStore((state) => state.setContributionOpen);
  const selectedOnGlobe = useWorldStore((state) => state.selectedRegion);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [category, setCategory] =
    useState<ContributionCategory>("plant");
  const [idea, setIdea] = useState(
    "أريد إضافة شجرة عملاقة تمتص التلوث وتضيء في الليل.",
  );
  const [analysis, setAnalysis] = useState<ContributionAnalysis | null>(null);
  const [regionId, setRegionId] = useState(selectedOnGlobe?.id ?? "");
  const [completedId, setCompletedId] = useState<string | null>(null);

  const compatibleRegions = useMemo(
    () =>
      analysis
        ? regions.filter(
            ({ biome }) =>
              biome !== "ocean" && analysis.possibleBiomes.includes(biome),
          )
        : regions.filter(({ biome }) => biome !== "ocean"),
    [analysis, regions],
  );

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeContribution({ category, idea, locale: "ar" }),
    onSuccess: (result) => {
      setAnalysis(result);
      const preferred =
        regions.find(
          ({ id, biome }) =>
            id === selectedOnGlobe?.id &&
            result.possibleBiomes.includes(biome),
        ) ??
        regions.find(({ biome }) => result.possibleBiomes.includes(biome));
      setRegionId(preferred?.id ?? "");
      setStep(2);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!analysis || !regionId) throw new Error("اختر منطقة بداية");
      const result = (await commitContribution(worldId, {
        analysis,
        regionId,
        idempotencyKey: crypto.randomUUID(),
      })) as { contribution: { id: string } };
      await runTicks(worldId, 25);
      return result;
    },
    onSuccess: async (result) => {
      setCompletedId(result.contribution.id);
      setStep(4);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["world"] }),
        queryClient.invalidateQueries({ queryKey: ["regions", worldId] }),
        queryClient.invalidateQueries({ queryKey: ["events", worldId] }),
      ]);
    },
  });

  if (!open) return null;

  const close = () => {
    setOpen(false);
    if (completedId) {
      setStep(1);
      setAnalysis(null);
      setCompletedId(null);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="contribution-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribution-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">مساهمة جديدة · الخطوة {step} من 4</span>
            <h2 id="contribution-title">أضف أثرًا إلى العالم</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="إغلاق">
            <X size={18} />
          </button>
        </header>

        <div className="step-track" aria-hidden="true">
          {[1, 2, 3, 4].map((item) => (
            <i key={item} className={item <= step ? "active" : ""} />
          ))}
        </div>

        {step === 1 && (
          <div className="flow-step">
            <h3>اختر الفئة واكتب الفكرة</h3>
            <div className="category-grid">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={category === item.id ? "selected" : ""}
                    onClick={() => setCategory(item.id)}
                  >
                    <Icon size={19} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <label className="field-label" htmlFor="contribution-idea">
              صف العنصر وخصائصه
            </label>
            <textarea
              id="contribution-idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              maxLength={2_000}
              rows={5}
            />
            <small>{idea.length} / 2000 — يعامل النص كبيانات غير موثوقة</small>
            {analyzeMutation.error && (
              <ErrorNotice message={analyzeMutation.error.message} />
            )}
            <button
              className="primary-button"
              disabled={idea.trim().length < 10 || analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
            >
              {analyzeMutation.isPending ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              تحليل الفكرة وبناء خصائصها
            </button>
          </div>
        )}

        {step === 2 && analysis && (
          <div className="flow-step">
            <div className="analysis-heading">
              <div>
                <span
                  className={`provider-badge ${analysis.sandbox ? "sandbox" : ""}`}
                >
                  {analysis.sandbox ? "Sandbox AI" : analysis.provider}
                </span>
                <h3>{analysis.name}</h3>
                <p>{analysis.description}</p>
              </div>
              <ScoreRing value={analysis.balanceScore} />
            </div>
            {analysis.moderation.adjusted && (
              <div className="balance-notice">
                <AlertTriangle size={17} />
                عُدلت الخصائص غير المحدودة إلى نسخة قابلة للمحاكاة.
              </div>
            )}
            <div className="trait-grid">
              {Object.entries(analysis.traits)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => (
                  <div key={key}>
                    <span>{traitLabels[key] ?? key}</span>
                    <b>{Math.round(value * 100)}%</b>
                    <i style={{ "--value": value } as React.CSSProperties} />
                  </div>
                ))}
            </div>
            <div className="pros-cons">
              <article>
                <h4>المزايا</h4>
                {analysis.benefits.map((benefit) => (
                  <span key={benefit}>
                    <Check size={14} /> {humanize(benefit)}
                  </span>
                ))}
              </article>
              <article className="risks">
                <h4>المخاطر</h4>
                {analysis.risks.map((risk) => (
                  <span key={risk}>
                    <AlertTriangle size={14} /> {humanize(risk)}
                  </span>
                ))}
              </article>
            </div>
            <div className="flow-actions">
              <button className="secondary-button" onClick={() => setStep(1)}>
                تعديل الفكرة
              </button>
              <button className="primary-button" onClick={() => setStep(3)}>
                اختيار منطقة البداية <ChevronLeft size={17} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && analysis && (
          <div className="flow-step">
            <h3>اختر منطقة البداية</h3>
            <p>
              تعرض القائمة المناطق المتوافقة خوارزميًا مع المناخ والرطوبة
              المحددين.
            </p>
            <div className="region-options">
              {compatibleRegions.slice(0, 24).map((region) => (
                <button
                  key={region.id}
                  className={regionId === region.id ? "selected" : ""}
                  onClick={() => setRegionId(region.id)}
                >
                  <i style={{ background: region.color }} />
                  <span>
                    <b>{region.nameAr}</b>
                    <small>
                      {region.biome} · {region.temperature}° · رطوبة{" "}
                      {Math.round(region.moisture * 100)}%
                    </small>
                  </span>
                  {regionId === region.id && <Check size={17} />}
                </button>
              ))}
            </div>
            {commitMutation.error && (
              <ErrorNotice message={commitMutation.error.message} />
            )}
            <div className="flow-actions">
              <button className="secondary-button" onClick={() => setStep(2)}>
                رجوع
              </button>
              <button
                className="primary-button"
                disabled={!regionId || commitMutation.isPending}
                onClick={() => commitMutation.mutate()}
              >
                {commitMutation.isPending ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
                إدخال العنصر وتشغيل 25 سنة
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flow-step completed-step">
            <div className="success-orbit">
              <Check size={30} />
            </div>
            <span className="eyebrow">تم الحفظ والمحاكاة فعليًا</span>
            <h3>بدأ أثر مساهمتك في الظهور</h3>
            <p>
              سُجل الحدث في Event Store، وتقدّم العالم 25 Tick. يمكنك رؤية
              النتائج في السجل وعلى الكوكب وفتح الخريطة السببية.
            </p>
            <code>{completedId}</code>
            <button className="primary-button" onClick={close}>
              العودة إلى العالم
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  return (
    <div
      className="score-ring"
      style={{ "--score": `${value * 360}deg` } as React.CSSProperties}
    >
      <b>{Math.round(value * 100)}</b>
      <small>توازن</small>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice">
      <AlertTriangle size={16} /> {message}
    </div>
  );
}

const traitLabels: Record<string, string> = {
  size: "الحجم",
  growthRate: "النمو",
  waterNeed: "حاجة الماء",
  pollutionAbsorption: "امتصاص التلوث",
  nightLuminosity: "الإضاءة",
  coldResistance: "مقاومة البرد",
  heatResistance: "مقاومة الحر",
  aggression: "العدوانية",
  intelligence: "الذكاء",
  adaptability: "التكيف",
  energyYield: "إنتاج الطاقة",
  contagion: "العدوى",
};

function humanize(value: string) {
  return value.replaceAll("_", " ");
}
