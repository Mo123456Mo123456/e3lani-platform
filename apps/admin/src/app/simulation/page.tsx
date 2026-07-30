'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

type Tick = {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  deltaSummary: Record<string, unknown> | null;
  processedAt: string;
};

type Snapshot = {
  id: string;
  planetId: string;
  tick: number;
  year: number;
  label: string | null;
  summary: string | null;
};

export default function SimulationPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        api.get<{ ticks: Tick[] }>('/admin/simulation/ticks', token, { limit: '100' }),
        api.get<{ snapshots: Snapshot[] }>('/admin/snapshots', token),
      ]);
      setTicks(t.ticks.slice().reverse());
      setSnapshots(s.snapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rollback(id: string) {
    if (!confirm('Rollback planet to this snapshot?')) return;
    setBusy(id);
    try {
      await api.post(`/admin/snapshots/${id}/rollback`, token);
      track('snapshot_rollback', { snapshotId: id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed');
    } finally {
      setBusy(null);
    }
  }

  async function global(action: 'pause' | 'resume') {
    setBusy(action);
    try {
      await api.post(`/admin/simulation/${action}`, token, {});
      track(action === 'pause' ? 'sim_pause' : 'sim_resume', { scope: 'all' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Simulation</h1>
          <p className="text-sm text-fg-muted">Tick monitor, snapshots, rollback</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={() => void global('pause')}>
            Pause all
          </button>
          <button type="button" className="admin-btn" disabled={!!busy} onClick={() => void global('resume')}>
            Resume all
          </button>
        </div>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="admin-card overflow-x-auto">
        <h2 className="mb-3 text-sm font-medium text-fg-muted">Recent ticks</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Planet</th>
              <th>Tick</th>
              <th>Year</th>
              <th>Source</th>
              <th>At</th>
            </tr>
          </thead>
          <tbody>
            {ticks.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs">{t.planetId.slice(0, 10)}…</td>
                <td>{t.tick}</td>
                <td>{t.year}</td>
                <td className="text-xs text-fg-muted">
                  {String((t.deltaSummary as { source?: string } | null)?.source || '—')}
                </td>
                <td className="text-xs text-fg-muted">{t.processedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card overflow-x-auto">
        <h2 className="mb-3 text-sm font-medium text-fg-muted">Snapshots</h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-fg-muted">No snapshots yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Planet</th>
                <th>Tick</th>
                <th>Year</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td>{s.label || s.summary || s.id.slice(0, 8)}</td>
                  <td className="font-mono text-xs">{s.planetId.slice(0, 10)}…</td>
                  <td>{s.tick}</td>
                  <td>{s.year}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn-danger text-xs"
                      disabled={!!busy}
                      onClick={() => void rollback(s.id)}
                    >
                      Rollback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
