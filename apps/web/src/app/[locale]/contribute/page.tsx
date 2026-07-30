"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Panel, Progress, Spinner } from "@kawkab/ui";
import { categoryColorOf } from "@kawkab/ui";
import type {
  ContributionCategory,
  ContributionPreview,
  NarrationFact,
  ScenarioReport,
  WorldEvent,
} from "@kawkab/shared-types";
import { CONTRIBUTION_CATEGORIES } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/i18n";

type Step = 0 | 1 | 2 | 3 | 4;

interface PreviewResponse extends ContributionPreview {
  contributionId: string;
  sandbox: boolean;
}

interface ConfirmResponse {
  contributionId: string;
  rootEventId: string | null;
  appliedAtTick: number;
  events: WorldEvent[];
  narration: string;
  grounded: boolean;
  sandbox: boolean;
  facts: NarrationFact[];
}

function Wizard() {
  const { t, locale } = useT();
  const params = useSearchParams();
  const user = useWorldStore((s) => s.user);
  const planetId = useWorldStore((s) => s.planetId);
  const preselectOrigin = params.get("origin");

  const [step, setStep] = useState<Step>(preselectOrigin ? 3 : 0);
  const [category, setCategory] = useState<ContributionCategory | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [originIndex, setOriginIndex] = useState<number | null>(preselectOrigin ? Number(preselectOrigin) : null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: MessageKey[] = ["contribute.step.category", "contribute.step.idea", "contribute.step.analysis", "contribute.step.origin", "contribute.step.confirm"];

  const analyze = async () => {
    if (!category || !planetId || text.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<PreviewResponse>(`/api/contributions?locale=${locale}`, {
        method: "POST",
        body: JSON.stringify({ planetId, category, text }),
      });
      setPreview(res);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview || originIndex === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<ConfirmResponse>(`/api/contributions/confirm?locale=${locale}`, {
        method: "POST",
        body: JSON.stringify({ contributionId: preview.contributionId, originIndex }),
      });
      setResult(res);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Panel title={t("contribute.title")}>
          <div className="text-dim text-sm">{t("contribute.loginRequired")}</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-xl font-bold mb-1">{t("contribute.title")}</h1>
      <div className="text-dim text-sm mb-4">{t("app.tagline")}</div>

      {/* stepper */}
      <div className="flex gap-1 mb-6">
        {steps.map((key, i) => (
          <div key={key} className={`flex-1 text-[10px] text-center pb-1 border-b-2 ${i <= step ? "border-tech text-tech" : "border-line text-dim"}`}>
            {t(key)}
          </div>
        ))}
      </div>

      {error && <div className="mb-4 text-war text-sm border border-war/40 rounded p-2">{error}</div>}

      {step === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CONTRIBUTION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setStep(1);
              }}
              className="rounded-lg border border-line bg-panel hover:bg-panelAlt p-4 text-start transition-colors"
              style={{ borderColor: category === cat ? categoryColorOf(cat) : undefined }}
            >
              <div className="w-3 h-3 rounded-full mb-2" style={{ background: categoryColorOf(cat) }} />
              <div className="text-sm font-semibold">{t(`category.${cat}` as MessageKey)}</div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && category && (
        <Panel title={t(`category.${category}` as MessageKey)}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("contribute.ideaPlaceholder")}
            rows={5}
            maxLength={4000}
            className="w-full bg-bg border border-line rounded-md p-3 text-sm focus:border-tech outline-none resize-y"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[11px] text-dim tabular-nums">{text.length}/4000</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>{t("contribute.back")}</Button>
              <Button disabled={busy || text.trim().length < 3} onClick={analyze}>
                {busy ? t("contribute.analyzing") : t("contribute.analyze")}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 2 && preview && (
        <AnalysisView preview={preview} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}

      {step === 3 && preview && (
        <Panel title={t("contribute.step.origin")}>
          <div className="text-xs text-dim mb-3">{t("contribute.suggested")}</div>
          <div className="grid gap-2 mb-4">
            {preview.suggestedOrigin.map((origin) => (
              <button
                key={origin.index}
                onClick={() => setOriginIndex(origin.index)}
                className={`flex justify-between items-center rounded border px-3 py-2 text-sm ${originIndex === origin.index ? "border-tech bg-tech/10" : "border-line hover:bg-panelAlt"}`}
              >
                <span dir="ltr" className="tabular-nums">{origin.lat.toFixed(1)}°, {origin.lon.toFixed(1)}°</span>
                <span className="text-nature tabular-nums">{formatPercent(origin.score, locale)}</span>
              </button>
            ))}
          </div>
          {originIndex !== null && !preview.suggestedOrigin.some((o) => o.index === originIndex) && (
            <div className="text-xs text-tech mb-3">✓ #{originIndex}</div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>{t("contribute.back")}</Button>
            <Button disabled={originIndex === null || busy} onClick={confirm}>
              {busy ? "…" : t("contribute.confirm")}
            </Button>
          </div>
        </Panel>
      )}

      {step === 4 && result && <ResultView result={result} locale={locale} />}
    </div>
  );
}

function AnalysisView({ preview, onBack, onNext }: { preview: PreviewResponse; onBack: () => void; onNext: () => void }) {
  const { t, locale } = useT();
  const adjusted = preview.balance.adjustments.length > 0;
  return (
    <div className="space-y-4">
      <Panel
        title={preview.parsed.name}
        actions={<Badge color={categoryColorOf(preview.parsed.category)}>{t(`category.${preview.parsed.category}` as MessageKey)}</Badge>}
      >
        <div className="text-sm text-dim mb-3">{preview.parsed.description}</div>
        <div className="text-xs font-semibold mb-2">{t("contribute.traits")}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-4">
          {Object.entries(preview.parsed.traits).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-dim" dir="ltr">{key}</span>
                <span className="tabular-nums">{Math.round((value ?? 0) * 100)}%</span>
              </div>
              <Progress value={key.endsWith("Multiplier") ? (value ?? 0) / 3 : (value ?? 0)} color="#38bdf8" height={4} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {preview.parsed.possibleBiomes.map((b) => (
            <Badge key={b} color="#34d399">{t(`biome.${b}` as MessageKey)}</Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {preview.parsed.risks.map((r) => (
            <Badge key={r} color="#fb923c">⚠ {r}</Badge>
          ))}
          {preview.parsed.benefits.map((b) => (
            <Badge key={b} color="#34d399">✓ {b}</Badge>
          ))}
        </div>
      </Panel>

      {preview.balance.issues.length > 0 && (
        <Panel title={t("contribute.balanceIssues")}>
          <ul className="text-xs space-y-1 text-hazard mb-2">
            {preview.balance.issues.map((issue, i) => (
              <li key={i}>• {issue.message}</li>
            ))}
          </ul>
          {adjusted && <div className="text-xs text-dim">{t("contribute.adjusted")}: {preview.balance.adjustments.join(" · ")}</div>}
        </Panel>
      )}

      <Panel title={t("contribute.success")}>
        <div className="flex items-center gap-4 mb-3">
          <span className="text-3xl font-bold text-tech tabular-nums">{formatPercent(preview.successProbability, locale)}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-semibold mb-1">{t("contribute.shortTerm")}</div>
            <ul className="space-y-1 text-dim">
              {preview.expectedShortTerm.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-1">{t("contribute.longTerm")}</div>
            <ul className="space-y-1 text-dim">
              {preview.expectedLongTerm.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          </div>
        </div>
        {preview.sandbox && <div className="mt-3"><Badge color="#facc15">{t("sandbox.badge")}</Badge></div>}
      </Panel>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>{t("contribute.back")}</Button>
        <Button onClick={onNext}>{t("contribute.next")}</Button>
      </div>
      <div className="hidden">{formatNumber(0, locale)}</div>
    </div>
  );
}

function ResultView({ result, locale }: { result: ConfirmResponse; locale: "ar" | "en" }) {
  const { t } = useT();
  const [scenarios, setScenarios] = useState<ScenarioReport | null>(null);
  const [busy, setBusy] = useState(false);
  const user = useWorldStore((s) => s.user);

  const runScenarios = async () => {
    setBusy(true);
    try {
      setScenarios(await api<ScenarioReport>(`/api/contributions/${result.contributionId}/scenarios?locale=${locale}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={t("contribute.done")}>
        <div className="text-xs font-semibold mb-1">{t("contribute.narration")}</div>
        <p className="text-sm leading-7 mb-2">{result.narration}</p>
        <div className="flex gap-2">
          {result.grounded && <Badge color="#34d399">✓ {t("contribute.grounded")}</Badge>}
          {result.sandbox && <Badge color="#facc15">{t("sandbox.badge")}</Badge>}
        </div>
      </Panel>

      <Panel title={`${t("home.liveFeed")} (${result.events.length})`}>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {result.events.map((ev) => (
            <div key={ev.id} className="text-xs border-b border-line/50 pb-2">
              <div className="font-medium">{ev.title}</div>
              <div className="text-dim">{ev.summary}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t("contribute.scenarios")}>
        {!scenarios ? (
          <Button onClick={runScenarios} disabled={busy}>
            {busy ? <Spinner /> : t("contribute.scenarios.run")}
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {scenarios.horizons.map((h) => (
              <div key={h.yearsAhead} className="rounded border border-line p-3">
                <div className="text-sm font-bold mb-2 text-tech">
                  {t(`contribute.years${h.yearsAhead}` as MessageKey)}
                </div>
                <Row label={t("contribute.mostLikely")} text={h.mostLikely} />
                <Row label={t("contribute.best")} text={h.bestCase} color="#34d399" />
                <Row label={t("contribute.worst")} text={h.worstCase} color="#f87171" />
                <div className="mt-2 text-[11px] text-dim">
                  {t("contribute.uncertainty")}: <span className="tabular-nums">{formatPercent(h.uncertainty, locale)}</span>
                  {" · "}
                  {t("contribute.drivers")}: {h.drivers.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {user && null}
    </div>
  );
}

function Row({ label, text, color }: { label: string; text: string; color?: string }) {
  return (
    <div className="text-xs mb-1.5">
      <span className="font-semibold" style={{ color: color ?? "#e6edf3" }}>{label}: </span>
      <span className="text-dim">{text}</span>
    </div>
  );
}

export default function ContributePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-dim">…</div>}>
      <Wizard />
    </Suspense>
  );
}
