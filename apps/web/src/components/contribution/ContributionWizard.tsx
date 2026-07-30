"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n";
import { useWorldStore } from "@/lib/store";

type Analysis = {
  traits: string[];
  risks: string[];
  score?: number;
};

const categoryKeys = ["nature", "civilization", "creature", "technology", "resource", "hazard"] as const;

export function ContributionWizard({ dictionary }: { dictionary: Dictionary }) {
  const open = useWorldStore((state) => state.wizardOpen);
  const setOpen = useWorldStore((state) => state.setWizardOpen);
  const location = useWorldStore((state) => state.selectedLocation);
  const setLocation = useWorldStore((state) => state.setSelectedLocation);
  const pushEvent = useWorldStore((state) => state.pushEvent);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<(typeof categoryKeys)[number]>("nature");
  const [idea, setIdea] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverFallback, setServerFallback] = useState(false);

  if (!open) return null;

  const resetAndClose = () => {
    setOpen(false);
    setStep(1);
    setAnalysis(null);
    setServerFallback(false);
  };

  async function next(event?: FormEvent) {
    event?.preventDefault();
    if (step === 3) {
      setBusy(true);
      try {
        const result = await api<Analysis>("/contributions/analyze", {
          method: "POST",
          body: JSON.stringify({ category, idea }),
        });
        setAnalysis(result);
      } catch {
        setServerFallback(true);
        setAnalysis({
          traits:
            dictionary.brand === "كوكب يولد أمامك"
              ? ["قابل للتكيف", "متنامٍ", "متصل بالنظام البيئي"]
              : ["Adaptive", "Expansive", "Ecosystem-linked"],
          risks:
            dictionary.brand === "كوكب يولد أمامك"
              ? ["اختلال الموارد", "أثر غير متوقع"]
              : ["Resource imbalance", "Unexpected consequences"],
          score: 72,
        });
      } finally {
        setBusy(false);
      }
    }
    setStep((current) => Math.min(7, current + 1));
  }

  async function confirm() {
    const selected = location ?? { latitude: 12.4, longitude: 32.8 };
    setBusy(true);
    try {
      await api("/contributions/confirm", {
        method: "POST",
        body: JSON.stringify({ category, idea, location: selected, analysis }),
      });
    } catch {
      setServerFallback(true);
    } finally {
      pushEvent({
        id: `local-${Date.now()}`,
        title: idea || dictionary.addTitle,
        description: dictionary.wizard.resultText,
        time: dictionary.now,
        importance: "medium",
        category,
        latitude: selected.latitude,
        longitude: selected.longitude,
      });
      setBusy(false);
      setStep(7);
    }
  }

  const titles = [
    dictionary.wizard.category,
    dictionary.wizard.idea,
    dictionary.wizard.analyze,
    dictionary.wizard.preview,
    dictionary.wizard.location,
    dictionary.wizard.confirm,
    dictionary.wizard.result,
  ];

  return (
    <div className="wizard-layer" role="dialog" aria-modal="true" aria-label={dictionary.wizard.title}>
      <form className="glass-panel wizard" onSubmit={next}>
        <div className="wizard-header">
          <div>
            <span className="eyebrow">
              {dictionary.wizard.step} {step} / 7
            </span>
            <h2>{titles[step - 1]}</h2>
          </div>
          <button type="button" className="close-button" onClick={resetAndClose} aria-label={dictionary.wizard.close}>
            ×
          </button>
        </div>
        <div className="step-dots">
          {Array.from({ length: 7 }, (_, index) => (
            <i className={index + 1 <= step ? "active" : ""} key={index} />
          ))}
        </div>

        <div className="wizard-content">
          {step === 1 && (
            <div className="wizard-categories">
              {categoryKeys.map((key) => (
                <button
                  type="button"
                  className={category === key ? "selected" : ""}
                  onClick={() => setCategory(key)}
                  key={key}
                >
                  <span>{key === "hazard" ? "△" : key === "civilization" ? "⌂" : key === "technology" ? "◇" : "◉"}</span>
                  {dictionary.categories[key]}
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <textarea
              autoFocus
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder={dictionary.wizard.ideaPlaceholder}
              minLength={8}
              required
            />
          )}
          {step === 3 && (
            <div className="analysis-visual">
              <div className={busy ? "analysis-core spinning" : "analysis-core"}>✦</div>
              <p>{dictionary.wizard.analyzing}</p>
            </div>
          )}
          {step === 4 && analysis && (
            <div className="analysis-grid">
              <section>
                <h3>{dictionary.wizard.traits}</h3>
                {analysis.traits.map((trait) => <span key={trait}>✓ {trait}</span>)}
              </section>
              <section className="risks">
                <h3>{dictionary.wizard.risks}</h3>
                {analysis.risks.map((risk) => <span key={risk}>△ {risk}</span>)}
              </section>
            </div>
          )}
          {step === 5 && (
            <div className="location-step">
              <div className="location-radar">⌖</div>
              <p>{dictionary.wizard.locationHint}</p>
              {location ? (
                <strong>{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°</strong>
              ) : (
                <button type="button" onClick={() => setLocation({ latitude: 12.4, longitude: 32.8 })}>
                  {dictionary.wizard.useSuggested}
                </button>
              )}
            </div>
          )}
          {step === 6 && (
            <div className="confirm-card">
              <span className="confirm-icon">✦</span>
              <h3>{idea}</h3>
              <p>{dictionary.categories[category]} · {location?.latitude ?? 12.4}°, {location?.longitude ?? 32.8}°</p>
              <small>{dictionary.wizard.confirming}</small>
            </div>
          )}
          {step === 7 && (
            <div className="result-card">
              <div className="result-rings">✓</div>
              <h3>{dictionary.wizard.result}</h3>
              <p>{dictionary.wizard.resultText}</p>
            </div>
          )}
          {serverFallback && <p className="fallback-note">{dictionary.fallback}</p>}
        </div>

        <div className="wizard-actions">
          {step > 1 && step < 7 && (
            <button type="button" className="secondary-button" onClick={() => setStep((value) => value - 1)}>
              {dictionary.wizard.back}
            </button>
          )}
          {step < 6 && (
            <button type="submit" className="primary-cta" disabled={busy || (step === 2 && idea.length < 8)}>
              {busy ? "•••" : dictionary.wizard.next}
            </button>
          )}
          {step === 6 && (
            <button type="button" className="primary-cta" onClick={confirm} disabled={busy}>
              {busy ? "•••" : dictionary.wizard.submit}
            </button>
          )}
          {step === 7 && (
            <button type="button" className="primary-cta" onClick={resetAndClose}>
              {dictionary.wizard.close}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
