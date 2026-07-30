"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { worldApi } from "../lib/api";
import { buildProposal } from "../lib/adapters";
import { getCopy, interpolate } from "../lib/i18n";
import type {
  ContributionAnalysis,
  ContributionCategory,
  ContributionDraft,
  ContributionRequest,
  ContributionResult,
  EffectMetric,
  Language,
  Region,
  SimulationForecast,
} from "../lib/types";
import { validateDraftStep } from "../lib/world";
import { Icon, type IconName } from "./Icon";

const STEPS = [
  "category",
  "idea",
  "analysis",
  "preview",
  "region",
  "forecast",
  "confirm",
] as const;

const CATEGORIES: Array<{
  id: ContributionCategory;
  icon: IconName;
  copyKey:
    | "categoryClimate"
    | "categoryEnergy"
    | "categoryWater"
    | "categoryCommunity";
}> = [
  { id: "climate", icon: "climate", copyKey: "categoryClimate" },
  { id: "energy", icon: "energy", copyKey: "categoryEnergy" },
  { id: "water", icon: "water", copyKey: "categoryWater" },
  { id: "community", icon: "community", copyKey: "categoryCommunity" },
];

const STEP_COPY = [
  ["categoryStep", "categoryHint"],
  ["ideaStep", "ideaHint"],
  ["analysisStep", "analysisHint"],
  ["previewStep", "previewHint"],
  ["regionStep", "regionHint"],
  ["forecastStep", "forecastHint"],
  ["confirmStep", "confirmHint"],
] as const;

const METRIC_KEYS: Record<
  EffectMetric,
  | "stability"
  | "biodiversity"
  | "temperature"
  | "population"
  | "prosperity"
  | "pollution"
> = {
  stability: "stability",
  biodiversity: "biodiversity",
  temperature: "temperature",
  population: "population",
  prosperity: "prosperity",
  pollution: "pollution",
};

function formatDelta(value: number): string {
  const rounded = Number(value.toFixed(3));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

interface ContributionModalProps {
  planetId: string;
  language: Language;
  regions: Region[];
  initialRegionId: string | null;
  onClose: () => void;
  onSuccess: (result: ContributionResult) => void;
}

export function ContributionModal({
  planetId,
  language,
  regions,
  initialRegionId,
  onClose,
  onSuccess,
}: ContributionModalProps) {
  const t = getCopy(language);
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<ContributionAnalysis | null>(null);
  const [forecast, setForecast] = useState<SimulationForecast | null>(null);
  const [draft, setDraft] = useState<ContributionDraft>({
    category: null,
    title: "",
    idea: "",
    regionId: initialRegionId,
  });

  const requestFromDraft = (): ContributionRequest => ({
    planetId,
    proposal: buildProposal(draft),
    regionId: draft.regionId,
  });

  const analysis = useMutation({
    mutationFn: (request: ContributionRequest) => worldApi.analyze(request),
    onSuccess: (result) => {
      setAnalysisResult(result);
      setStep(2);
    },
  });

  const preview = useMutation({
    mutationFn: (request: ContributionRequest) => worldApi.preview(request),
    onSuccess: (result) => {
      setAnalysisResult(result.analysis);
      setForecast(result);
      setStep(5);
    },
  });

  const contribution = useMutation({
    mutationFn: (request: ContributionRequest) =>
      worldApi.commit(request, idempotencyKey.current),
    onSuccess,
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !contribution.isPending) onClose();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable.item(0);
        const last = focusable.item(focusable.length - 1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contribution.isPending, onClose]);

  const updateText =
    (field: "title" | "idea") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
      setAnalysisResult(null);
      setForecast(null);
      analysis.reset();
      preview.reset();
    };

  const validationMessages = [
    t.validationCategory,
    t.validationIdea,
    "",
    "",
    t.validationRegion,
  ];

  const continueFlow = () => {
    setValidation(null);
    if (!validateDraftStep(step, draft)) {
      setValidation(validationMessages[step] ?? null);
      return;
    }
    if (step === 1) {
      setStep(2);
      analysis.mutate(requestFromDraft());
      return;
    }
    if (step === 2 && !analysisResult) return;
    if (step === 4) {
      setStep(5);
      preview.mutate(requestFromDraft());
      return;
    }
    if (step === 5 && !forecast) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setValidation(null);
    if (step === 5) {
      setForecast(null);
      preview.reset();
    }
    setStep((current) => Math.max(0, current - 1));
  };

  const selectedRegion = regions.find((region) => region.id === draft.regionId);
  const positiveEffects =
    analysisResult?.effects.filter((effect) => effect.delta >= 0) ?? [];
  const negativeEffects =
    analysisResult?.effects.filter((effect) => effect.delta < 0) ?? [];
  const [headingKey, hintKey] = STEP_COPY[step] ?? STEP_COPY[0];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !contribution.isPending) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        aria-describedby={`${titleId}-hint`}
        aria-labelledby={titleId}
        aria-modal="true"
        className="contribution-modal"
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">{t.contributionDialog}</span>
            <span className="step-count">
              {interpolate(t.stepOf, {
                current: step + 1,
                total: STEPS.length,
              })}
            </span>
          </div>
          <button
            aria-label={t.close}
            className="icon-button"
            disabled={contribution.isPending}
            onClick={onClose}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>

        <div aria-hidden="true" className="modal-progress">
          {STEPS.map((item, index) => (
            <span className={index <= step ? "is-complete" : ""} key={item} />
          ))}
        </div>

        <div className="modal-body">
          <div className="modal-title-block">
            <h2 id={titleId} ref={headingRef} tabIndex={-1}>
              {t[headingKey]}
            </h2>
            <p id={`${titleId}-hint`}>{t[hintKey]}</p>
          </div>

          {step === 0 && (
            <div className="category-grid">
              {CATEGORIES.map((category) => (
                <button
                  aria-pressed={draft.category === category.id}
                  className={`category-option ${
                    draft.category === category.id ? "is-selected" : ""
                  }`}
                  key={category.id}
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      category: category.id,
                    }));
                    setAnalysisResult(null);
                    setForecast(null);
                  }}
                  type="button"
                >
                  <Icon name={category.icon} size={27} />
                  <span>{t[category.copyKey]}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="form-stack">
              <label>
                <span>{t.ideaTitle}</span>
                <input
                  autoComplete="off"
                  maxLength={80}
                  onChange={updateText("title")}
                  placeholder={t.ideaTitlePlaceholder}
                  value={draft.title}
                />
              </label>
              <label>
                <span>{t.ideaBody}</span>
                <textarea
                  maxLength={1_850}
                  onChange={updateText("idea")}
                  placeholder={t.ideaBodyPlaceholder}
                  rows={7}
                  value={draft.idea}
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="analysis-review" aria-live="polite">
              {analysis.isPending && (
                <div className="modal-loading">
                  <span className="planet-loader" />
                  <p>{t.analysisLoading}</p>
                </div>
              )}
              {analysis.isError && (
                <div className="inline-error">
                  <strong>{t.analysisError}</strong>
                  <span>{analysis.error.message}</span>
                  <button
                    onClick={() => analysis.mutate(requestFromDraft())}
                    type="button"
                  >
                    {t.retry}
                  </button>
                </div>
              )}
              {analysisResult && (
                <>
                  <div className="analysis-summary-card">
                    <div>
                      <span className="eyebrow">{t.serverAnalysis}</span>
                      <h3>{analysisResult.title}</h3>
                      <p>{analysisResult.summary}</p>
                    </div>
                    <div className="analysis-scores">
                      <span>
                        <strong>
                          {Math.round(analysisResult.confidence * 100)}%
                        </strong>
                        <small>{t.confidence}</small>
                      </span>
                      <span>
                        <strong>
                          {Math.round(analysisResult.plausibility * 100)}%
                        </strong>
                        <small>{t.plausibility}</small>
                      </span>
                    </div>
                  </div>
                  <div className="effect-list">
                    <h3>{t.structuredEffects}</h3>
                    {analysisResult.effects.map((effect, index) => (
                      <article key={`${effect.metric}-${index}`}>
                        <span
                          className={
                            effect.delta >= 0 ? "positive" : "negative"
                          }
                        >
                          {formatDelta(effect.delta)} Δ
                        </span>
                        <div>
                          <strong>{t[METRIC_KEYS[effect.metric]]}</strong>
                          <p>{effect.rationale}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  {analysisResult.provider && (
                    <p className="provider-note">
                      {t.provider}: {analysisResult.provider}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && analysisResult && (
            <div className="impact-review-grid">
              <article className="impact-review-card benefits">
                <header>
                  <Icon name="spark" />
                  <h3>{t.benefits}</h3>
                </header>
                {positiveEffects.length > 0 ? (
                  <ul>
                    {positiveEffects.map((effect, index) => (
                      <li key={`${effect.metric}-${index}`}>
                        <strong>{t[METRIC_KEYS[effect.metric]]}</strong>
                        <span>{effect.rationale}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t.noWarnings}</p>
                )}
              </article>
              <article className="impact-review-card risks">
                <header>
                  <Icon name="activity" />
                  <h3>{t.risks}</h3>
                </header>
                <ul>
                  {analysisResult.warnings.map((warning, index) => (
                    <li key={`warning-${index}`}>
                      <strong>{t.warnings}</strong>
                      <span>{warning}</span>
                    </li>
                  ))}
                  {negativeEffects.map((effect, index) => (
                    <li key={`${effect.metric}-${index}`}>
                      <strong>{t[METRIC_KEYS[effect.metric]]}</strong>
                      <span>{effect.rationale}</span>
                    </li>
                  ))}
                </ul>
                {analysisResult.warnings.length === 0 &&
                  negativeEffects.length === 0 && <p>{t.noWarnings}</p>}
              </article>
            </div>
          )}

          {step === 4 && (
            <div className="region-choice-grid">
              {regions.map((region) => (
                <button
                  aria-pressed={draft.regionId === region.id}
                  className={`region-choice ${
                    draft.regionId === region.id ? "is-selected" : ""
                  }`}
                  key={region.id}
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      regionId: region.id,
                    }));
                    setForecast(null);
                    preview.reset();
                  }}
                  type="button"
                >
                  <i style={{ backgroundColor: region.accentColor }} />
                  <span>
                    <strong>{region.name[language]}</strong>
                    <small>
                      {t.stability} {region.stability}%
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="forecast-panel" aria-live="polite">
              {preview.isPending && (
                <div className="modal-loading">
                  <span className="planet-loader" />
                  <p>{t.forecastLoading}</p>
                </div>
              )}
              {preview.isError && (
                <div className="inline-error">
                  <strong>{t.forecastError}</strong>
                  <span>{preview.error.message}</span>
                  <button
                    onClick={() => preview.mutate(requestFromDraft())}
                    type="button"
                  >
                    {t.retry}
                  </button>
                </div>
              )}
              {forecast && (
                <>
                  <div className="forecast-summary">
                    <div className="forecast-score">
                      <span>
                        {Math.round(forecast.acceptanceProbability * 100)}%
                      </span>
                      <small>{t.acceptanceProbability}</small>
                    </div>
                    <div>
                      <p>{forecast.summary[language]}</p>
                      <small>
                        {t.samples}: {forecast.samples} · {t.instabilityRisk}:{" "}
                        {Math.round(forecast.riskOfInstability * 100)}%
                      </small>
                    </div>
                  </div>
                  <div className="forecast-intervals">
                    {forecast.metrics.map((metric) => (
                      <article key={metric.key}>
                        <span>{t[METRIC_KEYS[metric.key]]}</span>
                        <div>
                          <small>
                            {t.lowerBound}
                            <b>{formatDelta(metric.low)}</b>
                          </small>
                          <small className="is-median">
                            {t.median}
                            <b>{formatDelta(metric.median)}</b>
                          </small>
                          <small>
                            {t.upperBound}
                            <b>{formatDelta(metric.high)}</b>
                          </small>
                        </div>
                        <em>{metric.unit}</em>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 6 && forecast && analysisResult && (
            <div className="review-grid">
              <article className="review-card">
                <span>{t.reviewIdea}</span>
                <h3>{analysisResult.title}</h3>
                <p>{analysisResult.summary}</p>
                <div className="review-meta">
                  <span>{analysisResult.category}</span>
                  <span>{selectedRegion?.name[language]}</span>
                  <span>
                    {t.confidence} {Math.round(analysisResult.confidence * 100)}
                    %
                  </span>
                </div>
              </article>
              <article className="review-card accent">
                <span>{t.reviewImpact}</span>
                <strong className="large-score">
                  {Math.round(forecast.acceptanceProbability * 100)}%
                  <small>{t.acceptanceProbability}</small>
                </strong>
                <p>{forecast.summary[language]}</p>
              </article>
            </div>
          )}

          {(validation || contribution.isError) && (
            <p className="validation-message" role="alert">
              {validation ?? contribution.error?.message}
            </p>
          )}
        </div>

        <footer className="modal-footer">
          <button
            className="secondary-button"
            disabled={step === 0 || contribution.isPending}
            onClick={goBack}
            type="button"
          >
            <Icon name="arrow" size={17} />
            {t.back}
          </button>
          {step < 6 ? (
            <button
              className="primary-button"
              disabled={
                analysis.isPending ||
                preview.isPending ||
                (step === 2 && !analysisResult) ||
                (step === 5 && !forecast)
              }
              onClick={continueFlow}
              type="button"
            >
              {step === 4 ? t.simulate : t.continue}
              <Icon name="arrow" size={17} />
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={contribution.isPending}
              onClick={() => contribution.mutate(requestFromDraft())}
              type="button"
            >
              {contribution.isPending ? t.sending : t.publish}
              <Icon name="spark" size={17} />
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
