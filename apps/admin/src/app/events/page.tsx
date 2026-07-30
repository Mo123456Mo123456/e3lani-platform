'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type WorldEvent = {
  id: string;
  planetId: string;
  tick: number;
  type: string;
  title: string;
  description: string | null;
  severity: string;
  createdAt: string;
};

export default function EventsPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [type, setType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ events: WorldEvent[] }>('/admin/events', token, {
        type: type || undefined,
        limit: '200',
      });
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token, type]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">World events</h1>
          <p className="text-sm text-fg-muted">Browse simulation event log</p>
        </div>
        <input
          className="admin-input max-w-xs"
          placeholder="Filter by type…"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tick</th>
              <th>Type</th>
              <th>Title</th>
              <th>Severity</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="font-mono">{e.tick}</td>
                <td className="font-mono text-xs text-[var(--color-accent)]">{e.type}</td>
                <td>
                  <div>{e.title}</div>
                  {e.description && <div className="text-xs text-fg-muted">{e.description}</div>}
                </td>
                <td className="text-xs">{e.severity}</td>
                <td className="text-xs text-fg-muted">{e.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
