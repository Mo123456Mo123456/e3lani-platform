'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

type Planet = {
  id: string;
  name: string;
  seed: string;
  status: string;
  ageYears: number;
  currentTick: number;
  resolution: number;
};

export default function PlanetsPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ planets: Planet[] }>('/admin/planets', token);
      setPlanets(data.planets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(planetId: string, action: 'pause' | 'resume' | 'tick') {
    setBusy(planetId + action);
    setError(null);
    try {
      if (action === 'tick') {
        await api.post('/admin/simulation/tick', token, { planetId });
        track('sim_tick', { planetId });
      } else {
        await api.post(`/admin/simulation/${action}`, token, { planetId });
        track(action === 'pause' ? 'sim_pause' : 'sim_resume', { planetId });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Planets</h1>
        <p className="text-sm text-fg-muted">Seeds, status, and tick controls</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Seed</th>
              <th>Status</th>
              <th>Tick</th>
              <th>Age (y)</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {planets.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="font-mono text-xs text-fg-muted">{p.seed}</td>
                <td>
                  <span className={p.status === 'paused' ? 'text-warm' : 'text-success'}>{p.status}</span>
                </td>
                <td className="font-mono">{p.currentTick}</td>
                <td>{p.ageYears}</td>
                <td className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="admin-btn-ghost text-xs"
                    disabled={!!busy || p.status === 'paused'}
                    onClick={() => void act(p.id, 'pause')}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="admin-btn-ghost text-xs"
                    disabled={!!busy || p.status !== 'paused'}
                    onClick={() => void act(p.id, 'resume')}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="admin-btn text-xs"
                    disabled={!!busy || p.status === 'paused'}
                    onClick={() => void act(p.id, 'tick')}
                  >
                    Tick
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
