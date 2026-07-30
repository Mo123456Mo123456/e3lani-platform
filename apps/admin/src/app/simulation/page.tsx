"use client";

import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch, type PlanetSummary } from "@/lib/api";
import { readSession } from "@/lib/session";
import { useAdminResource } from "@/lib/use-admin-resource";

export default function SimulationPage() {
  const planet = useAdminResource<PlanetSummary>("/planets/default");
  const [steps, setSteps] = useState(1);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runTick() {
    const session = readSession();
    const planetId = planet.data?.id;

    if (!session || !planetId) {
      setError("A signed-in session and default planet are required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/simulation/${planetId}/tick`, session.token, {
        method: "POST",
        body: JSON.stringify({ steps }),
      });
      setResult(response);
      planet.reload();
    } catch (tickError) {
      setError(tickError instanceof Error ? tickError.message : "Simulation tick failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">World ops</p>
            <h2>Simulation</h2>
            <p>Run protected simulation ticks for the default planet. Rollback support exists in the API and should be gated by an explicit snapshot workflow.</p>
          </div>
          <span className="pill inactive">Rollback workflow pending</span>
        </div>

        {planet.error ? <div className="error">{planet.error}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="grid">
          <article className="card">
            <span className="muted">Planet</span>
            <h3>{planet.data?.name ?? planet.data?.nameAr ?? planet.data?.id ?? "Loading..."}</h3>
            <p>Current tick: {planet.data?.tick ?? "-"}</p>
          </article>
          <article className="card">
            <label className="form">
              Steps
              <input min={1} type="number" value={steps} onChange={(event) => setSteps(Math.max(1, Number(event.target.value)))} />
            </label>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="primary" disabled={loading || !planet.data?.id} type="button" onClick={runTick}>
                {loading ? "Running..." : "POST simulation tick"}
              </button>
              <button className="ghost" type="button" onClick={planet.reload}>
                Refresh planet
              </button>
            </div>
          </article>
        </section>

        {result ? (
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Last tick response</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </section>
        ) : null}
      </main>
    </AdminShell>
  );
}
