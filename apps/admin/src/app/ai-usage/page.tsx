"use client";

import { AdminShell } from "@/components/AdminShell";

export default function AiUsagePage() {
  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">Observability</p>
            <h2>AI usage</h2>
            <p>AI request monitoring is reserved for the first API endpoint that exposes usage, provider, cost, or latency data.</p>
          </div>
          <span className="pill inactive">Inactive</span>
        </div>
        <section className="grid">
          <article className="card">
            <span className="muted">Provider requests</span>
            <p className="metric">-</p>
            <p>No admin AI usage endpoint is available yet.</p>
          </article>
          <article className="card">
            <span className="muted">Estimated cost</span>
            <p className="metric">-</p>
            <p>Add cards here when the API emits billing counters or moderation/generation totals.</p>
          </article>
          <article className="card">
            <span className="muted">Latency</span>
            <p className="metric">-</p>
            <p>Ready for p95 and failure-rate metrics once exposed.</p>
          </article>
        </section>
      </main>
    </AdminShell>
  );
}
