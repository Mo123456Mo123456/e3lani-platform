"use client";

import { AdminShell } from "@/components/AdminShell";
import type { AdminOverview, PlanetSummary } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="card">
      <span className="muted">{label}</span>
      <p className="metric">{value}</p>
    </article>
  );
}

export default function DashboardPage() {
  const overview = useAdminResource<AdminOverview>("/admin/overview");
  const planet = useAdminResource<PlanetSummary>("/planets/default");

  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>Dashboard</h2>
            <p>Live platform status assembled from admin endpoints and the default planet summary.</p>
          </div>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              overview.reload();
              planet.reload();
            }}
          >
            Refresh
          </button>
        </div>

        {overview.error ? <div className="error">{overview.error}</div> : null}
        {planet.error ? <div className="error">{planet.error}</div> : null}

        <section className="grid">
          <Metric label="Users" value={overview.data?.users ?? (overview.loading ? "..." : "-")} />
          <Metric label="Planets" value={overview.data?.planets ?? (overview.loading ? "..." : "-")} />
          <Metric label="Pending contributions" value={overview.data?.pendingContributions ?? (overview.loading ? "..." : "-")} />
          <Metric label="Applied contributions" value={overview.data?.appliedContributions ?? (overview.loading ? "..." : "-")} />
          <Metric label="World events" value={overview.data?.events ?? (overview.loading ? "..." : "-")} />
          <Metric label="Rejected moderation" value={overview.data?.moderationRejected ?? (overview.loading ? "..." : "-")} />
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <span className="pill success">Default planet</span>
          <h3>{planet.data?.name ?? planet.data?.nameAr ?? planet.data?.id ?? "Loading planet..."}</h3>
          <div className="grid">
            <Metric label="Tick" value={planet.data?.tick ?? "-"} />
            <Metric label="Year" value={planet.data?.year ?? "-"} />
            <Metric label="Regions" value={planet.data?.regions?.length ?? "-"} />
            <Metric label="Civilizations" value={planet.data?.civilizations?.length ?? "-"} />
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
