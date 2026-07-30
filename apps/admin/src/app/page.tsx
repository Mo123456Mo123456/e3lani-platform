'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type Stats = {
  users: number;
  planets: number;
  planetsActive: number;
  planetsPaused: number;
  contributions: number;
  contributionsPending: number;
  events: number;
  eventsPerHour: number;
  sim: { latestTick: number; ticksRecorded: number; pausedCount: number; status: string };
  ai: { requests: number; estimatedUsd: number; note: string };
  moderation: { total: number; flagged: number; rejected: number };
  health: { api: string; db: string };
};

type HealthDetail = {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string; latencyMs?: number }>;
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="admin-card">
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const token = useAuth((s) => s.accessToken);
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, h] = await Promise.all([
          api.get<Stats>('/admin/stats', token),
          api.get<HealthDetail>('/admin/health-detail', token).catch(() => null),
        ]);
        if (!cancelled) {
          setStats(s);
          setHealth(h);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!stats) return <p className="text-fg-muted">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-fg-muted">Planet ops overview</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Stat label="Planets" value={stats.planets} hint={`${stats.planetsActive} active · ${stats.planetsPaused} paused`} />
        <Stat label="Users" value={stats.users} />
        <Stat label="Events / hour" value={stats.eventsPerHour} hint={`${stats.events} total events`} />
        <Stat
          label="Sim tick"
          value={stats.sim.latestTick}
          hint={`${stats.sim.status} · ${stats.sim.ticksRecorded} recorded`}
        />
        <Stat label="Pending contributions" value={stats.contributionsPending} hint={`${stats.contributions} total`} />
        <Stat
          label="AI cost"
          value={`$${stats.ai.estimatedUsd.toFixed(2)}`}
          hint={stats.ai.note}
        />
        <Stat
          label="Moderation"
          value={stats.moderation.flagged}
          hint={`${stats.moderation.rejected} rejected · ${stats.moderation.total} reports`}
        />
        <Stat label="API health" value={stats.health.api} hint={stats.health.db} />
      </div>

      {health && (
        <section className="admin-card">
          <h2 className="mb-3 text-sm font-medium text-fg-muted">Health checks</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {health.checks.map((c) => (
                <tr key={c.name}>
                  <td className="font-mono text-xs">{c.name}</td>
                  <td>
                    <span className={c.ok ? 'text-success' : 'text-warm'}>{c.ok ? 'ok' : 'degraded'}</span>
                  </td>
                  <td className="text-fg-muted">{c.latencyMs != null ? `${c.latencyMs}ms` : '—'}</td>
                  <td className="max-w-xs truncate text-xs text-fg-muted">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
