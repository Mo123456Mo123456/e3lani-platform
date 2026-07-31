"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Panel,
  Progress,
  Spinner,
  Textarea,
  useToast,
} from "@planet/ui";
import {
  CONTRIBUTION_CATEGORIES,
  type ContributionAssessment,
  type ScenarioReport,
  type StructuredContribution,
  type BalanceReportDto,
  type ContributionCategory,
} from "@planet/shared-types";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { TopBar } from "@/components/shell/TopBar";

type Step = "category" | "idea" | "analysis" | "region" | "preview" | "confirm" | "done";

const CATEGORY_TONES: Record<string, "nature" | "tech" | "civ" | "culture" | "danger" | "warning"> = {
  creature: "nature",
  plant: "nature",
  resource: "tech",
  civilization: "civ",
  invention: "tech",
  natural_phenomenon: "warning",
  disease: "danger",
  culture: "culture",
  world_law: "warning",
  custom: "tech",
};

const TRAIT_LABELS: Record<string, string> = {
  size: "الحجم / Size",
  growthRate: "معدل النمو / Growth",
  waterNeed: "احتياج الماء / Water need",
  coldResistance: "مقاومة البرد / Cold res.",
  heatResistance: "مقاومة الحر / Heat res.",
  pollutionAbsorption: "امتصاص التلوث / Pollution abs.",
  energyStorage: "تخزين الطاقة / Energy storage",
  nightLuminosity: "الإضاءة الليلية / Luminosity",
  nutrition: "القيمة الغذائية / Nutrition",
  toxicity: "السمية / Toxicity",
  spreadRate: "معدل الانتشار / Spread",
  reproductionRate: "التكاثر / Reproduction",
  intelligence: "الذكاء / Intelligence",
  aggression: "العدوانية / Aggression",
  speed: "السرعة / Speed",
  adaptability: "التكيف / Adaptability",
  mutationRate: "الطفرات / Mutation",
  sociality: "الاجتماعية / Sociality",
  value: "القيمة / Value",
  abundance: "الوفرة / Abundance",
  renewable: "التجدد / Renewable",
  envImpact: "الأثر البيئي / Env impact",
  population: "السكان / Population",
  techLevel: "التقنية / Tech",
  military: "العسكرية / Military",
  innovation: "الابتكار / Innovation",
  expansionism: "التوسعية / Expansionism",
  mercantilism: "التجارية / Mercantilism",
  education: "التعليم / Education",
  complexity: "التعقيد / Complexity",
  impact: "الأثر / Impact",
  rainfulness: "المطرية / Rainfulness",
  warmth: "الدفء / Warmth",
  coldness: "البرودة / Coldness",
  severity: "الشدة / Severity",
  transmission: "العدوى / Transmission",
  influence: "النفوذ / Influence",
  photosynthesisBoost: "تعزيز البناء الضوئي / Photosynthesis",
  cleanAir: "نقاء الهواء / Clean air",
  potency: "القوة / Potency",
  benefit: "النفع / Benefit",
};

export default function AddWizardPage() {
  return (
    <Suspense fallback={<div className="page"><Spinner /></div>}>
      <AddWizardInner />
    </Suspense>
  );
}

function AddWizardInner() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ContributionCategory | null>(null);
  const [text, setText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [contribution, setContribution] = useState<StructuredContribution | null>(null);
  const [balance, setBalance] = useState<BalanceReportDto | null>(null);
  const [graph, setGraph] = useState<{ nodes: Array<{ id: string; kind: string; label: string; strength: number }>; edges: Array<{ source: string; target: string; sign: string }> } | null>(null);
  const [sandbox, setSandbox] = useState(true);
  const [provider, setProvider] = useState("mock");
  const [targetCell, setTargetCell] = useState<number | null>(
    params.get("cell") ? Number(params.get("cell")) : null,
  );
  const [assessment, setAssessment] = useState<ContributionAssessment | null>(null);
  const [report, setReport] = useState<ScenarioReport | null>(null);
  const [finalTraits, setFinalTraits] = useState<Record<string, number | string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ narrative: string; events: Array<{ id: string; type: string }>; contributionId: string } | null>(null);

  const { data: planet } = useQuery({
    queryKey: ["planet-current"],
    queryFn: () => api().getPlanet(),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) router.replace(`/${locale}/login`);
  }, [user, router, locale]);

  const steps: Step[] = ["category", "idea", "analysis", "region", "preview", "confirm", "done"];
  const stepIndex = steps.indexOf(step);

  async function runAnalyze() {
    if (!planet || !category || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api().createContributionDraft({
        planetId: planet.id,
        text: text.trim(),
        category,
      });
      setDraftId(draft.id);
      const res = await api().analyzeContribution(draft.id);
      setContribution(res.contribution);
      setBalance(res.balance);
      setGraph(res.graph);
      setSandbox(res.sandbox);
      setProvider(res.provider);
      setFinalTraits(res.contribution.traits);
      if (res.balance?.verdict === "rejected") {
        setStep("analysis");
      } else {
        setStep("analysis");
      }
    } catch (err) {
      const detail = (err as { body?: { reasons?: string[] } })?.body?.reasons;
      setError(detail?.length ? `moderation: ${detail.join(", ")}` : dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function runAssess(cell: number | null) {
    if (!draftId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api().assessContribution(draftId, cell);
      setAssessment(res);
      setStep("preview");
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (!draftId) return;
    setBusy(true);
    setError(null);
    try {
      await api().previewContribution(draftId, { horizons: [1, 10, 100], runs: 3, targetCellId: targetCell });
      const started = Date.now();
      while (Date.now() - started < 300_000) {
        await new Promise((r) => setTimeout(r, 2500));
        const res = await api().getPreviewResult(draftId);
        if (res.status === "previewed" && res.report) {
          setReport(res.report);
          setStep("confirm");
          return;
        }
        if (res.status !== "previewing") {
          toast.push(dict.common.error, "danger");
          setStep("confirm");
          return;
        }
      }
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm() {
    if (!draftId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api().confirmContribution(draftId, {
        targetCellId: targetCell,
        finalTraits,
      });
      setResult({ narrative: res.narrative, events: res.events, contributionId: res.contribution.id });
      setStep("done");
      toast.push(dict.wizard.confirmed, "nature");
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  const numericTraits = useMemo(
    () =>
      Object.entries(finalTraits).filter(([, v]) => typeof v === "number") as Array<[string, number]>,
    [finalTraits],
  );

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 860 }}>
        <div className="page-header">
          <h1 className="page-title">{dict.wizard.title}</h1>
          {sandbox ? <Badge tone="warning">{dict.wizard.sandboxBadge} · {provider}</Badge> : null}
        </div>

        <div className="wizard-steps">
          {steps.slice(0, -1).map((s, i) => (
            <span
              key={s}
              className={`wizard-step ${i < stepIndex ? "wizard-step--done" : i === stepIndex ? "wizard-step--active" : ""}`}
            >
              {i + 1}. {dict.wizard[`step${s[0]!.toUpperCase()}${s.slice(1)}` as never] ?? s}
            </span>
          ))}
        </div>

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div style={{ height: 12 }} />

        {step === "category" ? (
          <div className="grid-cards">
            {CONTRIBUTION_CATEGORIES.map((cat) => (
              <Card
                key={cat}
                clickable
                onClick={() => {
                  setCategory(cat);
                  setStep("idea");
                }}
                style={{ textAlign: "center", padding: 22 }}
              >
                <Badge tone={CATEGORY_TONES[cat] ?? "tech"}>{dict.categories[cat]}</Badge>
              </Card>
            ))}
          </div>
        ) : null}

        {step === "idea" ? (
          <Panel title={dict.wizard.stepIdea} actions={<Badge tone="nature">{category ? dict.categories[category] : ""}</Badge>}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1200))}
              placeholder={dict.wizard.ideaPlaceholder}
              style={{ minHeight: 140 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
              <span className="pb-faint" style={{ fontSize: 11 }}>{text.length}/1200</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setStep("category")}>{dict.common.back}</Button>
                <Button variant="primary" disabled={busy || text.trim().length < 2} onClick={runAnalyze}>
                  {busy ? <Spinner /> : dict.wizard.analyze}
                </Button>
              </div>
            </div>
          </Panel>
        ) : null}

        {step === "analysis" && contribution ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {balance?.verdict === "adjusted" ? (
              <ErrorBox>{dict.wizard.balanceAdjusted} {(balance.issues ?? []).map((i) => (i as { trait?: string; code?: string }).trait ?? (i as { code?: string }).code).filter(Boolean).join("، ")}</ErrorBox>
            ) : null}
            {balance?.verdict === "rejected" ? (
              <ErrorBox>{dict.wizard.balanceRejected}</ErrorBox>
            ) : null}
            <Panel title={`${contribution.name}`} actions={<Badge tone="nature">{dict.categories[contribution.category]}</Badge>}>
              <div className="pb-label">{dict.wizard.traits}</div>
              {numericTraits.map(([name, value]) => (
                <div key={name} className="trait-row">
                  <span className="pb-dim">{TRAIT_LABELS[name] ?? name}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={value}
                    style={{ width: "100%" }}
                    onChange={(e) => setFinalTraits((prev) => ({ ...prev, [name]: Number(e.target.value) }))}
                  />
                  <output>{value.toFixed(2)}</output>
                </div>
              ))}
              <hr className="pb-divider" />
              <div className="pb-label">{dict.wizard.risks}</div>
              <div className="pb-chip-row">
                {contribution.risks.length ? (
                  contribution.risks.map((r) => <Badge key={r} tone="danger">{r}</Badge>)
                ) : (
                  <Badge tone="nature">—</Badge>
                )}
              </div>
              {graph ? (
                <>
                  <hr className="pb-divider" />
                  <div className="pb-label">{dict.events.causedBy}</div>
                  <div className="pb-chip-row">
                    {graph.nodes.filter((n) => n.kind !== "contribution").map((n) => (
                      <Badge key={n.id} tone={n.kind === "primary" ? "tech" : n.kind === "secondary" ? "culture" : "warning"}>
                        {n.label} · {Math.round(n.strength * 100)}%
                      </Badge>
                    ))}
                  </div>
                </>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <Button variant="ghost" onClick={() => setStep("idea")}>{dict.common.back}</Button>
                <Button variant="primary" onClick={() => setStep("region")} disabled={balance?.verdict === "rejected"}>
                  {dict.common.next}
                </Button>
              </div>
            </Panel>
          </div>
        ) : null}

        {step === "region" ? (
          <Panel title={dict.wizard.stepRegion}>
            <p className="pb-dim" style={{ fontSize: 13 }}>{dict.wizard.pickRegionHint}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge tone={targetCell !== null ? "nature" : undefined}>
                {dict.wizard.selectedCell}: {targetCell ?? dict.wizard.autoRegion}
              </Badge>
              <Link href={`/${locale}`} className="hud-chip">🌍</Link>
              <Button variant="ghost" size="sm" onClick={() => setTargetCell(null)}>{dict.wizard.autoRegion}</Button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setStep("analysis")}>{dict.common.back}</Button>
              <Button variant="primary" disabled={busy} onClick={() => runAssess(targetCell)}>
                {busy ? <Spinner /> : dict.common.next}
              </Button>
            </div>
          </Panel>
        ) : null}

        {step === "preview" && assessment ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Panel title={dict.wizard.stepAssessment}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="pb-label">{dict.wizard.success}</div>
                  <Progress value={assessment.successProbability} tone={assessment.successProbability > 0.6 ? "nature" : assessment.successProbability > 0.4 ? "civ" : "danger"} />
                </div>
                <span className="pb-mono" style={{ fontSize: 20 }}>{Math.round(assessment.successProbability * 100)}%</span>
              </div>
              <div className="pb-label">{dict.wizard.biomes}</div>
              <div className="pb-chip-row">
                {assessment.suitableBiomes.map((b) => (
                  <Badge key={b.biome} tone="nature">{b.biome} · {Math.round(b.fit * 100)}%</Badge>
                ))}
              </div>
              <div className="pb-label" style={{ marginTop: 12 }}>{dict.wizard.risks}</div>
              <div className="pb-chip-row">
                {assessment.risks.map((r) => <Badge key={r} tone="danger">{r}</Badge>)}
              </div>
            </Panel>
            <Panel title={dict.wizard.preview}>
              <p className="pb-dim" style={{ fontSize: 13 }}>{dict.wizard.probabilisticNote}</p>
              <Button variant="primary" onClick={runPreview} disabled={busy}>
                {busy ? <Spinner /> : dict.wizard.runPreview}
              </Button>
              {busy ? <div className="pb-dim" style={{ marginTop: 8, fontSize: 12 }}>{dict.wizard.previewRunning}</div> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <Button variant="ghost" onClick={() => setStep("confirm")}>{dict.common.next} ⏭</Button>
              </div>
            </Panel>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {report ? (
              <Panel title={dict.wizard.preview}>
                {report.horizons.map((h) => (
                  <div key={h.years} style={{ marginBottom: 14 }}>
                    <div className="pb-label">{dict.wizard.afterYears.replace("{n}", String(h.years))}</div>
                    <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                      <Card>
                        <Badge tone="tech">{dict.wizard.mostLikely}</Badge>
                        <div className="pb-mono" style={{ marginTop: 6, fontSize: 12 }}>
                          {dict.common.population}: {Math.round(h.mostLikely.population).toLocaleString()}<br />
                          {dict.nav.civilizations}: {h.mostLikely.civsAlive}<br />
                          wars: {h.mostLikely.warsStarted}
                        </div>
                      </Card>
                      <Card>
                        <Badge tone="nature">{dict.wizard.best}</Badge>
                        <div className="pb-mono" style={{ marginTop: 6, fontSize: 12 }}>
                          habitability: {h.best.habitability.toFixed(2)}
                        </div>
                      </Card>
                      <Card>
                        <Badge tone="danger">{dict.wizard.worst}</Badge>
                        <div className="pb-mono" style={{ marginTop: 6, fontSize: 12 }}>
                          habitability: {h.worst.habitability.toFixed(2)}
                        </div>
                      </Card>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
                      <span className="pb-dim" style={{ fontSize: 12 }}>{dict.wizard.uncertainty}: {Math.round(h.uncertainty * 100)}%</span>
                      <span className="pb-dim" style={{ fontSize: 12 }}>
                        {dict.wizard.drivers}: {h.drivers.map((d) => d.factor).join(", ")}
                      </span>
                    </div>
                  </div>
                ))}
              </Panel>
            ) : null}
            <Panel title={dict.wizard.stepConfirm}>
              <Button variant="nature" size="lg" block onClick={runConfirm} disabled={busy}>
                {busy ? <Spinner /> : `🚀 ${dict.wizard.confirm}`}
              </Button>
            </Panel>
          </div>
        ) : null}

        {step === "done" && result ? (
          <Panel title={`✨ ${dict.wizard.confirmed}`}>
            <div className="pb-label">{dict.wizard.narrativeTitle}</div>
            <p style={{ lineHeight: 1.9 }}>{result.narrative || "—"}</p>
            <div className="pb-chip-row" style={{ marginTop: 8 }}>
              {result.events.map((e) => (
                <Badge key={e.id} tone="civ">{e.type}</Badge>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Link href={`/${locale}/contributions/${result.contributionId}`}>
                <Button variant="primary">{dict.wizard.impactLink}</Button>
              </Link>
              <Link href={`/${locale}`}>
                <Button variant="ghost">{dict.nav.home}</Button>
              </Link>
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
