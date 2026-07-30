"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import { useAnalyzeContributionMutation, useCreateContributionMutation, usePlanetQuery } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/stores/locale-store";
import type { ContributionAnalysis, ElementCategory } from "@/types/domain";
import { AppShell } from "@/components/ui/AppShell";
import { ErrorState } from "@/components/ui/Status";
import styles from "@/app/app.module.css";

const categories: Array<{ key: ElementCategory; icon: string }> = [
  { key: "plant", icon: "✽" },
  { key: "creature", icon: "◇" },
  { key: "resource", icon: "◆" },
  { key: "civilization", icon: "▣" },
  { key: "technology", icon: "⌁" },
  { key: "disease", icon: "☍" },
  { key: "climate_phenomenon", icon: "≋" },
  { key: "natural_law", icon: "∞" },
  { key: "custom", icon: "✦" },
];

function getElement(analysis?: ContributionAnalysis) {
  return analysis?.structuredElement ?? analysis?.element;
}

function clampPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function ContributeWizard() {
  const { locale, t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const planet = usePlanetQuery();
  const analyze = useAnalyzeContributionMutation();
  const create = useCreateContributionMutation();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<ElementCategory>("plant");
  const [idea, setIdea] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [analysis, setAnalysis] = useState<ContributionAnalysis | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const element = getElement(analysis);
  const resultGraph = create.data?.causalGraph ?? analysis?.causalGraph;
  const resultForecast = create.data?.forecast ?? analysis?.forecast;

  const steps = [
    t.contribute.stepCategory,
    t.contribute.stepIdea,
    t.contribute.stepAnalyze,
    t.contribute.stepRegion,
    t.contribute.stepConfirm,
    t.contribute.stepResult,
  ];

  const selectedRegion = useMemo(
    () => planet.data?.regions?.find((region) => region.id === selectedRegionId),
    [planet.data?.regions, selectedRegionId],
  );

  async function handleAnalyze(event?: FormEvent) {
    event?.preventDefault();
    setLocalError(null);

    if (!planet.data?.id) {
      setLocalError(t.dashboard.apiError);
      return;
    }

    try {
      const response = await analyze.mutateAsync({ planetId: planet.data.id, category, idea, locale });
      setAnalysis(response);
      setStep(2);
    } catch {
      // The mutation error is rendered below.
    }
  }

  async function handleSubmitContribution() {
    setLocalError(null);

    if (!planet.data?.id || !selectedRegionId || !analysis) {
      setLocalError(t.contribute.mustAnalyze);
      return;
    }

    try {
      await create.mutateAsync({
        planetId: planet.data.id,
        category,
        idea,
        regionId: selectedRegionId,
        analysisId: analysis.id,
        structuredElement: element,
      });
      setStep(5);
    } catch {
      // The mutation error is rendered below.
    }
  }

  function goNext() {
    if (step === 0) setStep(1);
    if (step === 1) void handleAnalyze();
    if (step === 2) setStep(3);
    if (step === 3) setStep(4);
    if (step === 4) void handleSubmitContribution();
  }

  return (
    <AppShell>
      <section className={styles.routeHero}>
        <span className={styles.eyebrow}>{t.actions.addElement}</span>
        <h1>{t.contribute.title}</h1>
        <p>{t.contribute.subtitle}</p>
        {!user ? (
          <p className={styles.hint}>
            <Link className={styles.navLink} href="/login">
              {t.actions.login}
            </Link>{" "}
            {t.contribute.honestInactive}
          </p>
        ) : null}
      </section>

      <section className={styles.wizard}>
        <aside className={`${styles.panel} ${styles.steps}`}>
          {steps.map((label, index) => (
            <button
              key={label}
              className={`${styles.step} ${index === step ? styles.stepActive : ""}`}
              type="button"
              onClick={() => setStep(index)}
              disabled={index > step + 1 && step !== 5}
            >
              {index + 1}. {label}
            </button>
          ))}
        </aside>

        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            {planet.error ? <ErrorState error={planet.error} /> : null}
            {localError ? <div className={styles.errorBadge}>{localError}</div> : null}
            {analyze.error ? (
              <div className={styles.errorBadge}>
                {t.contribute.submitFailure}: {getApiErrorMessage(analyze.error)}
              </div>
            ) : null}
            {create.error ? (
              <div className={styles.errorBadge}>
                {t.contribute.submitFailure}: {getApiErrorMessage(create.error)}
              </div>
            ) : null}

            {step === 0 ? (
              <>
                <h2>{t.contribute.stepCategory}</h2>
                <div className={styles.choiceGrid}>
                  {categories.map((item) => (
                    <button
                      key={item.key}
                      className={`${styles.choice} ${item.key === category ? styles.choiceActive : ""}`}
                      type="button"
                      onClick={() => setCategory(item.key)}
                    >
                      <span className={styles.categoryIcon}>{item.icon}</span>
                      <strong>{t.categories[item.key]}</strong>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <form className={styles.formGrid} onSubmit={handleAnalyze}>
                <label className={styles.field}>
                  <span>{t.contribute.ideaLabel}</span>
                  <textarea
                    className={styles.textarea}
                    required
                    minLength={12}
                    value={idea}
                    placeholder={t.contribute.ideaPlaceholder}
                    onChange={(event) => setIdea(event.target.value)}
                  />
                </label>
                <button className={styles.button} type="submit" disabled={analyze.isPending || !idea.trim()}>
                  {analyze.isPending ? t.states.loading : t.actions.analyze}
                </button>
              </form>
            ) : null}

            {step === 2 ? (
              <>
                <h2>{t.contribute.stepAnalyze}</h2>
                {!element ? <p className={styles.hint}>{t.contribute.honestInactive}</p> : null}
                {element ? (
                  <div className={styles.detailsGrid}>
                    <article className={styles.routeCard}>
                      <h3>{locale === "ar" ? element.nameAr || element.name : element.nameEn || element.name}</h3>
                      <p>{element.description}</p>
                      <div className={styles.bar} aria-hidden="true">
                        <div className={styles.barFill} style={{ width: `${clampPercent((element.balanceScore ?? 0) * 100)}%` }} />
                      </div>
                    </article>
                    <article className={styles.routeCard}>
                      <h3>{t.contribute.previewTraits}</h3>
                      <ul className={styles.miniList}>
                        {Object.entries(element.traits ?? {}).map(([key, value]) => (
                          <li key={key}>
                            {key}: {typeof value === "number" ? value.toFixed(2) : "—"}
                          </li>
                        ))}
                      </ul>
                    </article>
                    <article className={styles.routeCard}>
                      <h3>{t.contribute.previewRisks}</h3>
                      <ul className={styles.miniList}>
                        {(element.risks?.length ? element.risks : analysis?.risks ?? [t.states.empty]).map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </article>
                    <article className={styles.routeCard}>
                      <h3>{t.contribute.previewBenefits}</h3>
                      <ul className={styles.miniList}>
                        {(element.benefits?.length ? element.benefits : analysis?.benefits ?? [t.states.empty]).map((benefit) => (
                          <li key={benefit}>{benefit}</li>
                        ))}
                      </ul>
                    </article>
                  </div>
                ) : null}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h2>{t.actions.selectRegion}</h2>
                <div className={styles.choiceGrid}>
                  {planet.data?.regions?.map((region) => (
                    <button
                      key={region.id}
                      className={`${styles.choice} ${region.id === selectedRegionId ? styles.choiceActive : ""}`}
                      type="button"
                      onClick={() => setSelectedRegionId(region.id)}
                    >
                      <strong>{locale === "ar" ? region.nameAr : region.name}</strong>
                      <span>{region.biome}</span>
                      <span>{t.explore.fertility}: {region.fertility}</span>
                    </button>
                  ))}
                </div>
                {!planet.data?.regions?.length ? <p className={styles.hint}>{t.states.empty}</p> : null}
              </>
            ) : null}

            {step === 4 ? (
              <>
                <h2>{t.contribute.stepConfirm}</h2>
                <article className={styles.routeCard}>
                  <p>
                    <strong>{t.contribute.stepCategory}:</strong> {t.categories[category]}
                  </p>
                  <p>
                    <strong>{t.contribute.stepIdea}:</strong> {idea}
                  </p>
                  <p>
                    <strong>{t.actions.selectRegion}:</strong>{" "}
                    {selectedRegion ? (locale === "ar" ? selectedRegion.nameAr : selectedRegion.name) : t.states.unavailable}
                  </p>
                  <p className={styles.hint}>{t.contribute.honestInactive}</p>
                </article>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <span className={styles.successBadge}>{t.contribute.submitSuccess}</span>
                <div className={styles.detailsGrid}>
                  <article className={styles.routeCard}>
                    <h3>{t.contribute.causalGraph}</h3>
                    {resultGraph?.nodes?.length ? (
                      <div className={styles.graph}>
                        {resultGraph.nodes.map((node) => (
                          <div key={node.id} className={styles.graphNode}>
                            <strong>{node.label}</strong>
                            <p className={styles.hint}>
                              {node.kind} · {Math.round(node.confidence * 100)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.hint}>{t.states.unavailable}</p>
                    )}
                  </article>
                  <article className={styles.routeCard}>
                    <h3>{t.contribute.forecast}</h3>
                    {resultForecast ? (
                      <>
                        <p>{locale === "ar" ? resultForecast.mostLikelyAr || resultForecast.mostLikely : resultForecast.mostLikely}</p>
                        <p className={styles.hint}>
                          {resultForecast.horizonYears}y · {Math.round(resultForecast.uncertainty * 100)}% {t.states.unavailable}
                        </p>
                      </>
                    ) : (
                      <p className={styles.hint}>{t.states.unavailable}</p>
                    )}
                  </article>
                </div>
              </>
            ) : null}

            <div className={styles.actionsRow}>
              <button className={styles.ghostButton} type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || step === 5}>
                {t.actions.back}
              </button>
              {step < 5 ? (
                <button
                  className={styles.button}
                  type="button"
                  onClick={goNext}
                  disabled={
                    planet.isLoading ||
                    analyze.isPending ||
                    create.isPending ||
                    (step === 1 && !idea.trim()) ||
                    (step === 3 && !selectedRegionId)
                  }
                >
                  {step === 1 ? t.actions.analyze : step === 4 ? t.actions.confirm : t.actions.continue}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
