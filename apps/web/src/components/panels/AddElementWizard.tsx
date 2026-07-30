"use client";

/**
 * The contribution wizard — the product's core flow:
 *   category → idea → AI analysis → balance report → origin pick →
 *   preview simulation → confirm → placement + causal links.
 * Every step talks to the real API; nothing is faked client-side.
 */
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api, type AnalyzeResponse, type PreviewResponse } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { CONTRIBUTION_CATEGORIES, type ContributionCategory, type Plant, type WorldEvent } from "@planet/shared-types";
import { plantSuitability, type WorldState } from "@planet/simulation-models";

const TRAIT_LABELS: Record<string, [string, string]> = {
  size: ["الحجم", "Size"],
  growthRate: ["سرعة النمو", "Growth"],
  reproductionRate: ["التكاثر", "Reproduction"],
  waterNeed: ["حاجة الماء", "Water need"],
  pollutionAbsorption: ["امتصاص التلوث", "Pollution absorption"],
  nightLuminosity: ["التوهج الليلي", "Night glow"],
  coldResistance: ["مقاومة البرد", "Cold resist"],
  heatResistance: ["مقاومة الحر", "Heat resist"],
  intelligence: ["الذكاء", "Intelligence"],
  aggression: ["العدوانية", "Aggression"],
  mobility: ["الحركة", "Mobility"],
  adaptability: ["التكيف", "Adaptability"],
  mutationRate: ["الطفرات", "Mutation"],
  lifespan: ["العمر", "Lifespan"],
  energyStorage: ["تخزين الطاقة", "Energy storage"],
  toxicity: ["السمية", "Toxicity"],
  yield: ["المحصول", "Yield"],
  value: ["القيمة", "Value"],
  rarity: ["الندرة", "Rarity"],
  severity: ["الشدة", "Severity"],
  contagiousness: ["العدوى", "Contagiousness"],
  efficiency: ["الكفاءة", "Efficiency"],
};

export function AddElementWizard() {
  const { t, locale } = useI18n();
  const user = useAppStore((s) => s.user);
  const wizard = useAppStore((s) => s.wizard);
  const patchWizard = useAppStore((s) => s.patchWizard);
  const resetWizard = useAppStore((s) => s.resetWizard);
  const planetConfig = useAppStore((s) => s.planetConfig);
  const grid = useAppStore((s) => s.grid);
  const setSelectedCell = useAppStore((s) => s.setSelectedCell);

  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [acceptSuggestion, setAcceptSuggestion] = useState(false);
  const [placedEvents, setPlacedEvents] = useState<WorldEvent[]>([]);
  const [impactText, setImpactText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planetId = planetConfig?.planetId;

  const bestCell = useMemo(() => {
    if (!grid || !analysis || !planetId) return null;
    const structured = analysis.structured;
    let best = -1;
    let bestScore = -1;
    for (const cell of grid.cells) {
      let score = -1;
      if (structured.category === "plant") {
        const probe = {
          suitableBiomes: structured.possibleBiomes,
          traits: {
            waterNeed: structured.traits.waterNeed ?? 0.5,
            heatResistance: structured.traits.heatResistance ?? 0.4,
            coldResistance: structured.traits.coldResistance ?? 0.4,
          },
        } as Plant;
        const suit = plantSuitability(probe, { grid } as WorldState, cell.index);
        score = suit + cell.fertility * 0.3;
      } else if (structured.category === "resource") {
        score = cell.biome === "mountains" || cell.biome === "volcanic" ? cell.height : -1;
      } else if (structured.category === "civilization") {
        score = !cell.ownerId && cell.height >= grid.seaLevel ? cell.fertility : -1;
      } else {
        score = cell.height >= grid.seaLevel ? cell.fertility + cell.moisture * 0.3 : -1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = cell.index;
      }
    }
    return best >= 0 ? best : null;
  }, [grid, analysis, planetId]);

  if (!user) return null;

  const step = wizard.step;

  const doAnalyze = async () => {
    if (!planetId || !wizard.text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.analyze(planetId, wizard.text, wizard.category ?? undefined, locale);
      setAnalysis(result);
      setAcceptSuggestion(!result.balance.balanced);
      patchWizard({ analysisId: result.analysisId, step: 2 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "analyze failed");
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async (cell: number) => {
    if (!planetId || !wizard.analysisId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.preview(planetId, wizard.analysisId, cell, acceptSuggestion);
      setPreview(result);
      patchWizard({ step: 4 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "preview failed");
    } finally {
      setBusy(false);
    }
  };

  const doPlace = async () => {
    if (!planetId || !wizard.analysisId || wizard.placementCell === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.place(planetId, wizard.analysisId, wizard.placementCell, acceptSuggestion);
      setPlacedEvents(result.events);
      patchWizard({ step: 5, placedContributionId: result.contribution.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "place failed");
    } finally {
      setBusy(false);
    }
  };

  const showImpact = async () => {
    if (!planetId || !wizard.placedContributionId) return;
    const [impact, narrative] = await Promise.all([
      api.impact(planetId, wizard.placedContributionId),
      api.narrative(planetId, wizard.placedContributionId, locale),
    ]);
    setImpactText(
      `${narrative.narrative}\n\n— ${impact.impact.eventCount} events, causal depth ${impact.impact.depth}`,
    );
  };

  return (
    <aside className="panel add-panel">
      {!wizard.open && (
        <>
          <button
            className="add-cta"
            onClick={() => {
              resetWizard();
              patchWizard({ open: true, step: 0 });
            }}
          >
            <span className="add-cta-plus">＋</span>
            {t.add.button}
          </button>
          <UserStatsStrip />
        </>
      )}

      {wizard.open && (
        <div className="wizard">
          <div className="wizard-header">
            <h2 className="panel-title">{t.add.title}</h2>
            <button className="close-btn" onClick={() => patchWizard({ open: false })}>✕</button>
          </div>
          <ol className="wizard-steps">
            {[t.add.stepCategory, t.add.stepIdea, t.add.stepAnalysis, t.add.stepLocation, t.add.stepPreview, t.add.stepDone].map((label, i) => (
              <li key={i} className={i === step ? "active" : i < step ? "done" : ""}>{label}</li>
            ))}
          </ol>

          {step === 0 && (
            <div className="wizard-body">
              <div className="category-grid">
                {CONTRIBUTION_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    className={`category-card ${wizard.category === category ? "selected" : ""}`}
                    onClick={() => patchWizard({ category })}
                  >
                    {t.add.categories[category as ContributionCategory]}
                  </button>
                ))}
              </div>
              <button className="primary-btn" disabled={!wizard.category} onClick={() => patchWizard({ step: 1 })}>
                {t.common.next}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-body">
              <textarea
                className="idea-input"
                rows={5}
                placeholder={t.add.ideaPlaceholder}
                value={wizard.text}
                onChange={(e) => patchWizard({ text: e.target.value })}
                maxLength={2000}
              />
              <button className="ghost-btn" disabled title={t.add.voiceNote}>🎙 {t.add.voiceNote}</button>
              <div className="wizard-actions">
                <button className="ghost-btn" onClick={() => patchWizard({ step: 0 })}>{t.common.back}</button>
                <button className="primary-btn" disabled={wizard.text.trim().length < 4 || busy} onClick={doAnalyze}>
                  {busy ? t.add.analyzing : t.add.analyze}
                </button>
              </div>
            </div>
          )}

          {step === 2 && analysis && (
            <div className="wizard-body">
              <h3 className="analysis-name">{analysis.structured.name}</h3>
              <p className="provider-line">
                {t.add.provider}: <b>{analysis.provider}</b>
                {analysis.sandbox && <span className="sandbox-badge">{t.add.sandboxBadge}</span>}
              </p>
              {analysis.flaggedForReview && <p className="moderation-flag">{t.add.moderation}</p>}

              <h4>{t.add.traits}</h4>
              <div className="traits-list">
                {Object.entries(analysis.structured.traits).map(([key, value]) => (
                  <div key={key} className="trait-row">
                    <span>{TRAIT_LABELS[key]?.[locale === "ar" ? 0 : 1] ?? key}</span>
                    <span className="trait-bar"><i style={{ width: `${Math.round(value * 100)}%` }} /></span>
                    <span>{Math.round(value * 100)}</span>
                  </div>
                ))}
              </div>

              {analysis.structured.risks.length > 0 && (
                <>
                  <h4>{t.add.risks}</h4>
                  <ul className="risks-list">
                    {analysis.structured.risks.map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                </>
              )}

              <p className={`balance-line ${analysis.balance.balanced ? "ok" : "bad"}`}>
                {analysis.balance.balanced ? `✓ ${t.add.balanceOk}` : `⚠ ${t.add.balanceBad}`}
              </p>
              {!analysis.balance.balanced && analysis.balance.suggested && (
                <label className="suggestion-check">
                  <input
                    type="checkbox"
                    checked={acceptSuggestion}
                    onChange={(e) => setAcceptSuggestion(e.target.checked)}
                  />
                  {t.add.acceptSuggestion} ({t.add.suggested})
                </label>
              )}

              <div className="wizard-actions">
                <button className="ghost-btn" onClick={() => patchWizard({ step: 1 })}>{t.common.back}</button>
                <button
                  className="primary-btn"
                  disabled={!analysis.balance.balanced && !acceptSuggestion}
                  onClick={() => {
                    patchWizard({ step: 3, pickingLocation: true });
                  }}
                >
                  {t.common.next}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-body">
              <p>{t.add.pickLocation}</p>
              <div className="location-actions">
                <button className="ghost-btn" onClick={() => patchWizard({ pickingLocation: true })}>
                  🎯 {t.add.pickLocation}
                </button>
                <button
                  className="ghost-btn"
                  disabled={bestCell === null}
                  onClick={() => {
                    if (bestCell !== null) {
                      patchWizard({ placementCell: bestCell, pickingLocation: false });
                      setSelectedCell(bestCell);
                    }
                  }}
                >
                  ✨ {t.add.autoLocation}
                </button>
              </div>
              <p className="selected-cell">
                {t.add.selectedCell}: {wizard.placementCell !== null ? `#${wizard.placementCell}` : "—"}
              </p>
              <div className="wizard-actions">
                <button className="ghost-btn" onClick={() => patchWizard({ step: 2 })}>{t.common.back}</button>
                <button
                  className="primary-btn"
                  disabled={wizard.placementCell === null || busy}
                  onClick={() => doPreview(wizard.placementCell!)}
                >
                  {busy ? t.add.previewing : t.add.runPreview}
                </button>
              </div>
            </div>
          )}

          {step === 4 && preview && (
            <div className="wizard-body">
              <div className="viability">
                <span>{t.add.viability}</span>
                <span className="viability-meter">
                  <i style={{ width: `${Math.round(preview.viability * 100)}%` }} />
                </span>
                <b>{Math.round(preview.viability * 100)}%</b>
              </div>
              <p className="env-line">
                {t.region.biome}: {preview.environment.biome} · {t.region.moisture}: {Math.round(preview.environment.moisture * 100)}% · {t.region.fertility}: {Math.round(preview.environment.fertility * 100)}%
              </p>
              {preview.predictedEvents.length > 0 && (
                <>
                  <h4>{t.add.predictedEvents}</h4>
                  <ul className="predicted-list">
                    {preview.predictedEvents.slice(0, 6).map((event) => (
                      <li key={event.id}>{event.type} · {t.common.year} {event.year}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="wizard-actions">
                <button className="ghost-btn" onClick={() => patchWizard({ step: 3 })}>{t.common.back}</button>
                <button className="primary-btn confirm" disabled={busy} onClick={doPlace}>
                  {busy ? t.add.placing : t.add.confirm}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="wizard-body">
              <p className="placed-line">✦ {t.add.placed}</p>
              <ul className="predicted-list">
                {placedEvents.map((event) => (
                  <li key={event.id}>{event.type} · {event.cause}</li>
                ))}
              </ul>
              <div className="wizard-actions">
                <button className="ghost-btn" onClick={showImpact}>{t.add.viewImpact} · {t.add.viewNarrative}</button>
                <button className="primary-btn" onClick={() => patchWizard({ open: false })}>{t.region.close}</button>
              </div>
              {impactText && <pre className="impact-text">{impactText}</pre>}
            </div>
          )}

          {error && <p className="error-line">{error}</p>}
        </div>
      )}
    </aside>
  );
}

function UserStatsStrip() {
  const { t } = useI18n();
  const notifications = useAppStore((s) => s.notifications);
  const [stats, setStats] = useState<{ contributions: number; placed: number; totalImpact: number } | null>(null);

  useEffect(() => {
    api.me().then((res) => setStats(res.stats)).catch(() => setStats(null));
  }, []);

  if (!stats) return null;
  return (
    <div className="stats-strip">
      <h3>{t.stats.title}</h3>
      <div className="stats-grid">
        <div><b>{stats.contributions}</b><span>{t.stats.contributions}</span></div>
        <div><b>{stats.placed}</b><span>{t.stats.impacts}</span></div>
        <div><b>{notifications.filter((n) => !n.read).length}</b><span>{t.stats.unread}</span></div>
      </div>
    </div>
  );
}
