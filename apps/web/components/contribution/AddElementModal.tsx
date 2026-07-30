"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { t } from "@/i18n/dict";

type Props = {
  open: boolean;
  initialCategory?: string;
  regions: { id: string; biome: string; lat: number; lon: number; fertility?: number }[];
  onClose: () => void;
  onCommitted: () => void;
};

export function AddElementModal({
  open,
  initialCategory,
  regions,
  onClose,
  onCommitted,
}: Props) {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const d = t(locale);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(initialCategory ?? "plant");
  const [text, setText] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [structured, setStructured] = useState<Record<string, unknown> | null>(null);
  const [narrative, setNarrative] = useState("");
  const [provider, setProvider] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [regionId, setRegionId] = useState("");
  const [projection, setProjection] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const analyze = async () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{
        analysisId: string;
        structured: Record<string, unknown>;
        narrative: string;
        narrativeAr: string;
        provider: string;
        sandbox: boolean;
        suitableRegions: { id: string }[];
      }>("/contributions/analyze", {
        method: "POST",
        json: { text, category, locale },
      });
      setAnalysisId(res.analysisId);
      setStructured(res.structured);
      setNarrative(locale === "ar" ? res.narrativeAr : res.narrative);
      setProvider(res.provider);
      setSandbox(res.sandbox);
      if (res.suitableRegions[0]) setRegionId(res.suitableRegions[0].id);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const project = async () => {
    setBusy(true);
    try {
      const res = await api("/simulation/project", {
        method: "POST",
        json: { years: [1, 10, 100, 1000], samples: 6 },
      });
      setProjection(res);
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!analysisId || !regionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api("/contributions/confirm", {
        method: "POST",
        json: { analysisId, regionId, acceptBalance: true },
      });
      setResult(res);
      setStep(5);
      onCommitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const traits = (structured?.traits ?? {}) as Record<string, number>;
  const risks = (structured?.risks as string[]) ?? [];
  const benefits = (structured?.benefits as string[]) ?? [];
  const balanceNotes = (structured?.balanceNotes as string[]) ?? [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(2,6,14,0.72)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="panel fade-in"
        style={{
          width: "min(640px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "1.25rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <strong>{d.addElement}</strong>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <span
              key={s}
              className="chip"
              style={{
                borderColor: step === s ? "var(--cyan)" : "var(--border)",
                color: step === s ? "var(--cyan)" : undefined,
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {error && (
          <div style={{ color: "var(--red)", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {step <= 2 && (
          <>
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 6 }}>
                {locale === "ar" ? "الفئة" : "Category"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(Object.keys(d.categories) as (keyof typeof d.categories)[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="chip"
                    style={{
                      cursor: "pointer",
                      borderColor: category === c ? "var(--cyan)" : "var(--border)",
                      background: "transparent",
                      color: category === c ? "var(--cyan)" : undefined,
                    }}
                    onClick={() => setCategory(c)}
                  >
                    {d.categories[c]}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={d.writeIdea}
              rows={5}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
                padding: "0.75rem",
                resize: "vertical",
              }}
            />
            <button
              className="btn btn-primary"
              type="button"
              style={{ marginTop: "0.75rem", width: "100%" }}
              disabled={busy || text.trim().length < 3}
              onClick={analyze}
            >
              {busy ? "…" : d.analyze}
            </button>
          </>
        )}

        {step === 3 && structured && (
          <>
            {sandbox && (
              <div className="chip" style={{ marginBottom: 8, color: "var(--gold)" }}>
                {d.sandboxAi} · {provider}
              </div>
            )}
            <p style={{ fontSize: "0.9rem", lineHeight: 1.55 }}>{narrative}</p>
            <h4 style={{ margin: "0.75rem 0 0.35rem" }}>{d.traits}</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(traits).map(([k, v]) => (
                <div key={k} style={{ fontSize: "0.78rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{k}</span>
                    <span>{v.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${v * 100}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--cyan), var(--green))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.8rem" }}>
              <div>
                <strong>{d.risks}</strong>
                <ul>{risks.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <strong>{d.benefits}</strong>
                <ul>{benefits.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>
            {balanceNotes.length > 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--orange)" }}>
                {d.balanceNotes}: {balanceNotes.join(" · ")}
              </div>
            )}
            <h4 style={{ margin: "0.75rem 0 0.35rem" }}>{d.chooseRegion}</h4>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg-panel-solid)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.5rem",
              }}
            >
              {regions
                .filter((r) => r.biome !== "ocean")
                .slice(0, 40)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.biome} · fert {(r.fertility ?? 0).toFixed(2)}
                  </option>
                ))}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: "0.85rem" }}>
              <button className="btn" type="button" onClick={project} disabled={busy}>
                {d.whatHappens}
              </button>
              <button className="btn btn-primary" type="button" onClick={confirm} disabled={busy}>
                {d.confirm}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <pre
              style={{
                fontSize: "0.72rem",
                whiteSpace: "pre-wrap",
                background: "rgba(0,0,0,0.35)",
                padding: "0.75rem",
                borderRadius: 8,
                maxHeight: 280,
                overflow: "auto",
              }}
            >
              {JSON.stringify(projection, null, 2)}
            </pre>
            <button className="btn btn-primary" type="button" onClick={confirm} disabled={busy}>
              {d.confirm}
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: 8 }}>
              {d.success}
            </div>
            <pre
              style={{
                fontSize: "0.72rem",
                whiteSpace: "pre-wrap",
                background: "rgba(0,0,0,0.35)",
                padding: "0.75rem",
                borderRadius: 8,
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
            <button className="btn" type="button" onClick={onClose}>
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
