"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type AnalysisResult,
  type ForecastResult,
  type InjectResult,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { CategoryPicker } from "./CategoryPicker";
import { ElementPreview } from "./ElementPreview";
import { CausalPreview } from "./CausalPreview";
import { ForecastPanel } from "./ForecastPanel";

const STEP_KEYS = [
  "category",
  "idea",
  "analyze",
  "traits",
  "balance",
  "region",
  "preview",
  "confirm",
  "result",
  "causal",
  "forecast",
  "done",
] as const;

type Step = (typeof STEP_KEYS)[number];

export function ContributeWizard() {
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);
  const token = useAuthStore((s) => s.accessToken);

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [balanceScore, setBalanceScore] = useState<number | null>(null);
  const [balanceHints, setBalanceHints] = useState<string[]>([]);
  const [sandbox, setSandbox] = useState(false);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [previewEvents, setPreviewEvents] = useState<{ title?: string; type?: string }[]>([]);
  const [injectResult, setInjectResult] = useState<InjectResult | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: regionsData } = useQuery({
    queryKey: ["regions-wizard", planetId],
    queryFn: () => api.getRegions(planetId!),
    enabled: !!planetId,
  });

  const stepIndex = STEP_KEYS.indexOf(step);
  const stepLabel = dict.contribute.steps[step];

  const canNext = useMemo(() => {
    if (step === "category") return !!category;
    if (step === "idea") return title.trim().length >= 2;
    if (step === "region") return !!regionId;
    return true;
  }, [step, category, title, regionId]);

  async function runAnalyze() {
    if (!token) {
      setError(locale === "ar" ? "يجب تسجيل الدخول أولاً" : "Please log in first");
      return;
    }
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeContribution({
        planetId: planetId || undefined,
        type: category,
        title,
        description,
        payload: regionId ? { regionId } : {},
      });
      setAnalysis(res.analysis);
      setBalanceScore(res.balanceScore);
      setBalanceHints(res.balanceHints || res.analysis.balanceHints || []);
      setSandbox(res.sandbox || res.analysis.provider === "local-mock");
      setStep("traits");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.contribute.error);
    } finally {
      setLoading(false);
    }
  }

  async function runCreatePreview() {
    if (!planetId || !category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.createContribution({
        planetId,
        type: category,
        title,
        description,
        payload: { regionId },
        inject: false,
      });
      setContributionId(res.id);
      if (res.analysis) setAnalysis(res.analysis);
      if (res.balanceScore != null) setBalanceScore(res.balanceScore);
      const events = (res.preview?.events as { title?: string; type?: string }[]) || [];
      setPreviewEvents(events);
      if (res.status === "rejected") {
        setError(locale === "ar" ? "رُفضت المساهمة بواسطة الإشراف" : "Contribution rejected by moderation");
      } else {
        setStep("preview");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.contribute.error);
    } finally {
      setLoading(false);
    }
  }

  async function runInject() {
    if (!contributionId) {
      await runCreatePreview();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.injectContribution(contributionId);
      setInjectResult(res);
      setStep("result");
    } catch (err) {
      // If inject fails (role), try create with inject:true
      try {
        if (!planetId || !category) throw err;
        const res = await api.createContribution({
          planetId,
          type: category,
          title,
          description,
          payload: { regionId },
          inject: true,
        });
        setContributionId(res.id);
        setInjectResult(res as unknown as InjectResult);
        setStep("result");
      } catch (err2) {
        setError(err2 instanceof ApiError ? err2.message : dict.contribute.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function runForecast() {
    if (!contributionId) {
      setStep("done");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.forecastContribution(contributionId, 50);
      setForecast(res);
      setStep("forecast");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.contribute.error);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  async function goNext() {
    setError(null);
    if (step === "category") setStep("idea");
    else if (step === "idea") setStep("analyze");
    else if (step === "analyze") await runAnalyze();
    else if (step === "traits") setStep("balance");
    else if (step === "balance") setStep("region");
    else if (step === "region") await runCreatePreview();
    else if (step === "preview") setStep("confirm");
    else if (step === "confirm") await runInject();
    else if (step === "result") setStep("causal");
    else if (step === "causal") await runForecast();
    else if (step === "forecast") setStep("done");
  }

  function goBack() {
    setError(null);
    const i = STEP_KEYS.indexOf(step);
    if (i > 0 && i < 8) setStep(STEP_KEYS[i - 1]!);
  }

  if (!token) {
    return (
      <Panel title={dict.contribute.title}>
        <p className="mb-3 text-sm text-muted">
          {locale === "ar" ? "سجّل الدخول لإضافة عناصر إلى العالم." : "Log in to add elements to the world."}
        </p>
        <Link href="/login">
          <Button>{dict.nav.login}</Button>
        </Link>
      </Panel>
    );
  }

  const resultEvents = (injectResult?.events || previewEvents).map((e, i) => ({
    id: injectResult?.eventIds?.[i],
    title: (e as { title?: string }).title,
    type: (e as { type?: string }).type,
  }));

  return (
    <Panel
      title={dict.contribute.title}
      action={
        <div className="flex items-center gap-2">
          {sandbox && <Badge tone="gold">{dict.contribute.sandboxBadge}</Badge>}
          <Badge tone="cyan">
            {stepIndex + 1}/12 · {stepLabel}
          </Badge>
        </div>
      }
    >
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan to-green transition-all"
          style={{ width: `${((stepIndex + 1) / 12) * 100}%` }}
        />
      </div>

      {step === "category" && <CategoryPicker value={category} onChange={setCategory} />}

      {step === "idea" && (
        <div className="space-y-3">
          <label className="block text-xs text-muted">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-cyan/25 bg-slate-950/60 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </label>
          <label className="block text-xs text-muted">
            {dict.contribute.ideaPlaceholder}
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-cyan/25 bg-slate-950/60 px-3 py-2 text-sm text-ink outline-none focus:border-cyan/50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
          </label>
        </div>
      )}

      {step === "analyze" && (
        <div className="space-y-3">
          <ElementPreview title={title} description={description} category={category || ""} />
          <p className="text-sm text-muted">
            {loading ? dict.contribute.analyzing : dict.contribute.steps.analyze}
          </p>
        </div>
      )}

      {step === "traits" && analysis && (
        <div className="space-y-3">
          <ElementPreview
            title={title}
            description={description}
            category={category || ""}
            analysis={analysis}
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-white/10 p-3">
              <div className="text-xs text-muted">Risk</div>
              <div className="text-xl font-bold text-orange">{(analysis.risk * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="text-xs text-muted">Balance</div>
              <div className="text-xl font-bold text-green">
                {balanceScore != null ? (balanceScore * 100).toFixed(0) : "—"}%
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "balance" && (
        <ul className="space-y-2">
          {(balanceHints.length ? balanceHints : analysis?.balanceHints || []).map((h) => (
            <li key={h} className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-sm text-ink">
              {h}
            </li>
          ))}
        </ul>
      )}

      {step === "region" && (
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {(regionsData?.regions || []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegionId(r.id)}
              className={`rounded-lg border p-2 text-start text-xs transition ${
                regionId === r.id
                  ? "border-cyan/50 bg-cyan/10"
                  : "border-white/10 hover:border-cyan/30"
              }`}
            >
              <div className="font-medium text-ink">{r.name}</div>
              <div className="text-muted">
                ({r.x},{r.y}) · {r.temperature.toFixed(0)}°
              </div>
            </button>
          ))}
          {!regionsData?.regions?.length && (
            <p className="col-span-full text-sm text-muted">{dict.pages.empty}</p>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-3">
          <ElementPreview
            title={title}
            description={description}
            category={category || ""}
            analysis={analysis}
          />
          <h4 className="text-xs uppercase text-muted">{dict.contribute.steps.preview}</h4>
          <CausalPreview events={previewEvents} />
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-ink">
            {locale === "ar"
              ? "هل تريد حقن هذا العنصر في محاكاة الكوكب؟"
              : "Inject this element into the planet simulation?"}
          </p>
          <ElementPreview title={title} description={description} category={category || ""} analysis={analysis} />
        </div>
      )}

      {step === "result" && (
        <div className="space-y-3">
          <Badge tone="green">{dict.contribute.success}</Badge>
          <CausalPreview events={resultEvents} />
        </div>
      )}

      {step === "causal" && <CausalPreview events={resultEvents} />}

      {step === "forecast" && <ForecastPanel forecast={forecast} />}

      {step === "done" && (
        <div className="space-y-3 text-center">
          <p className="text-lg font-bold text-gradient-cyan">{dict.contribute.success}</p>
          <div className="flex justify-center gap-2">
            <Link href="/">
              <Button variant="secondary">{dict.nav.home}</Button>
            </Link>
            <Link href="/timeline">
              <Button>{dict.nav.timeline}</Button>
            </Link>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red">{error}</p>}

      {step !== "done" && (
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0 || loading || stepIndex >= 8}>
            {dict.contribute.back}
          </Button>
          <Button
            onClick={goNext}
            disabled={!canNext || loading}
          >
            {loading
              ? "..."
              : step === "confirm"
                ? dict.contribute.submit
                : dict.contribute.next}
          </Button>
        </div>
      )}
    </Panel>
  );
}
