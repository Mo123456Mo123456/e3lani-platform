"use client";

import React, { useMemo, useState } from "react";
import {
  ContributionCategory,
  type AnalyzedContribution,
  type BalanceResult,
  type ContributionPreview,
} from "@planet/shared-types";
import { Panel, Button, Badge, Spinner, Stat } from "@planet/ui";
import { useI18n } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api";
import { useUiStore, useWorldStore } from "@/lib/store";

type Step = "category" | "describe" | "analysis" | "region" | "preview" | "done";

const CATEGORY_KEYS = Object.values(ContributionCategory);

/**
 * Multi-stage contribution flow (section 16):
 * category → description → AI analysis → traits/risks → region pick →
 * Monte-Carlo preview → confirm → live in the world.
 */
export function Wizard({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const worldId = useWorldStore((s) => s.worldId);
  const mode = useWorldStore((s) => s.mode);
  const selectedCell = useUiStore((s) => s.selectedCell);
  const setWizardPickMode = useUiStore((s) => s.setWizardPickMode);

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<ContributionCategory>(ContributionCategory.Plant);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzedContribution | null>(null);
  const [balance, setBalance] = useState<BalanceResult | null>(null);
  const [preview, setPreview] = useState<ContributionPreview | null>(null);

  const canGoLive = mode === "live";

  const analyze = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!canGoLive) {
        // Local preview: analyze via the same orchestrator rules client-side.
        const { MockAnalyzerLocal } = await import("@/lib/localAnalysis");
        const result = MockAnalyzerLocal.analyze(category, text);
        setAnalysis(result);
        setBalance(MockAnalyzerLocal.balance(text, result));
        setContributionId(`local-${Date.now()}`);
        setStep("analysis");
        return;
      }
      const draft = await api<{ id: string }>("/contributions", {
        method: "POST", auth: true,
        body: { category, text, worldId: worldId ?? "demo-world" },
      });
      setContributionId(draft.id);
      const result = await api<{ analysis: AnalyzedContribution; balance: BalanceResult }>(
        `/contributions/${draft.id}/analyze`,
        { method: "POST", auth: true, body: { locale } },
      );
      setAnalysis(result.analysis);
      setBalance(result.balance);
      setStep("analysis");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    if (selectedCell === null) {
      setError("pick_region_first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!canGoLive) {
        const { MockAnalyzerLocal } = await import("@/lib/localAnalysis");
        setPreview(MockAnalyzerLocal.preview(analysis!, selectedCell));
        setStep("preview");
        return;
      }
      const result = await api<ContributionPreview>(`/contributions/${contributionId}/preview`, {
        method: "POST", auth: true, body: { cellIndex: selectedCell },
      });
      setPreview(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!canGoLive) {
        setStep("done");
        return;
      }
      await api(`/contributions/${contributionId}/confirm`, { method: "POST", auth: true });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const traitEntries = useMemo(
    () => (analysis ? Object.entries(analysis.traits).filter(([, v]) => (v as number) > 0.05) : []),
    [analysis],
  );

  return (
    <Panel
      title={t.wizard.title}
      right={<button onClick={onClose} className="chip">{t.common.close}</button>}
      style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
    >
      <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {step === "category" && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "var(--planet-text-dim)" }}>{t.wizard.category}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {CATEGORY_KEYS.map((c) => (
                <button
                  key={c}
                  className={`chip ${category === c ? "active" : ""}`}
                  style={{ justifyContent: "center" }}
                  onClick={() => setCategory(c)}
                >
                  {t.categories[c]}
                </button>
              ))}
            </div>
            <Button onClick={() => setStep("describe")}>{t.wizard.next}</Button>
          </>
        )}

        {step === "describe" && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "var(--planet-text-dim)" }}>{t.wizard.describeHint}</p>
            <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
            {!canGoLive && (
              <Badge color="var(--planet-orange)">{t.wizard.sandboxNotice}</Badge>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="ghost" onClick={() => setStep("category")}>{t.wizard.back}</Button>
              <Button disabled={text.trim().length < 4 || busy} onClick={analyze}>
                {busy ? t.wizard.analyzing : t.wizard.analyze}
              </Button>
            </div>
          </>
        )}

        {step === "analysis" && analysis && (
          <>
            {analysis.sandbox && <Badge color="var(--planet-orange)">{t.wizard.sandboxNotice}</Badge>}
            <h4 style={{ margin: 0, color: "var(--planet-accent)" }}>{analysis.name}</h4>
            <p style={{ margin: 0, fontSize: 12, color: "var(--planet-text-dim)" }}>{analysis.summary}</p>

            {balance?.verdict === "adjust" && <Badge color="var(--planet-gold)">{t.wizard.balanceAdjust}</Badge>}
            {balance?.verdict === "reject" && <Badge color="var(--planet-red)">{t.wizard.balanceReject}</Badge>}

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {traitEntries.slice(0, 10).map(([key, value]) => (
                <div key={key} className="trait-bar">
                  <span style={{ width: 110, color: "var(--planet-text-dim)" }}>{key}</span>
                  <span className="bar"><span className="fill" style={{ width: `${(value as number) * 100}%` }} /></span>
                  <span style={{ width: 30, textAlign: "end" }}>{Math.round((value as number) * 100)}</span>
                </div>
              ))}
            </div>

            {analysis.risks.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: "var(--planet-red)" }}>{t.wizard.risks}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {analysis.risks.map((r) => <Badge key={r} color="var(--planet-red)">{r}</Badge>)}
                </div>
              </div>
            )}
            {analysis.benefits.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: "var(--planet-green)" }}>{t.wizard.benefits}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {analysis.benefits.map((b) => <Badge key={b} color="var(--planet-green)">{b}</Badge>)}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="ghost" onClick={() => setStep("describe")}>{t.wizard.back}</Button>
              <Button disabled={balance?.verdict === "reject"} onClick={() => { setStep("region"); setWizardPickMode(true); }}>
                {t.wizard.next}
              </Button>
            </div>
          </>
        )}

        {step === "region" && (
          <>
            <p style={{ margin: 0, fontSize: 12, color: "var(--planet-text-dim)" }}>{t.wizard.pickRegion}</p>
            <div style={{ fontSize: 13 }}>
              {selectedCell !== null ? (
                <Badge color="var(--planet-accent)">#{selectedCell}</Badge>
              ) : (
                <span style={{ color: "var(--planet-text-dim)" }}>…</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="ghost" onClick={() => { setStep("analysis"); setWizardPickMode(false); }}>{t.wizard.back}</Button>
              <Button disabled={selectedCell === null || busy} onClick={runPreview}>
                {busy ? <Spinner size={14} /> : t.wizard.preview}
              </Button>
            </div>
          </>
        )}

        {step === "preview" && preview && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Stat label={t.wizard.success} value={`${Math.round(preview.successProbability * 100)}%`} color="var(--planet-green)" />
              <Stat label={t.wizard.envImpact} value={`${Math.round(preview.environmentalImpact * 100)}%`} />
              <Stat label={t.wizard.ecoImpact} value={`${Math.round(preview.economicImpact * 100)}%`} color="var(--planet-gold)" />
            </div>

            <span style={{ fontSize: 12, color: "var(--planet-accent)" }}>{t.wizard.horizons}</span>
            {preview.horizons.map((h) => (
              <div key={h.years} style={{ border: "1px solid var(--planet-border)", borderRadius: 8, padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <strong>{h.years} {t.wizard.years}</strong>
                  <span style={{ color: "var(--planet-text-dim)" }}>
                    {t.wizard.uncertainty}: {Math.round(h.uncertainty * 100)}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--planet-text-dim)", marginTop: 4 }}>
                  {t.wizard.likely}: {Math.round(h.summary.biosphereHealth * 100)}% bio · {Math.round(h.summary.civProsperity * 100)}% civ
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {h.keyFactors.map((f) => <Badge key={f}>{f}</Badge>)}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="ghost" onClick={() => setStep("region")}>{t.wizard.back}</Button>
              <Button disabled={busy} onClick={confirm}>
                {busy ? <Spinner size={14} /> : t.wizard.confirm}
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <p style={{ fontSize: 14, color: "var(--planet-green)" }}>{t.wizard.applied}</p>
            <Button onClick={onClose}>{t.common.close}</Button>
          </>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </Panel>
  );
}
