'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

type Contribution = {
  id: string;
  userId: string;
  planetId: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  balanceScore: number | null;
  createdAt: string;
};

export default function ContributionsPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [items, setItems] = useState<Contribution[]>([]);
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ contributions: Contribution[] }>('/admin/contributions', token, {
        status: status || undefined,
      });
      setItems(data.contributions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await api.post(`/admin/contributions/${id}/${action}`, token, action === 'reject' ? { reason: 'moderator_reject' } : {});
      track(action === 'approve' ? 'contribution_approve' : 'contribution_reject', { id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Contributions</h1>
          <p className="text-sm text-fg-muted">Review queue — approve or reject</p>
        </div>
        <select className="admin-input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">pending</option>
          <option value="analyzing">analyzing</option>
          <option value="balanced">balanced</option>
          <option value="rejected">rejected</option>
          <option value="injected">injected</option>
        </select>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {items.length === 0 && <p className="text-fg-muted">No contributions in this filter.</p>}
        {items.map((c) => (
          <div key={c.id} className="admin-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="mt-0.5 text-xs text-fg-muted">
                  {c.type} · {c.status} · planet {c.planetId.slice(0, 8)}…
                </div>
                {c.description && <p className="mt-2 text-sm text-fg-muted">{c.description}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="admin-btn text-xs"
                  disabled={!!busy || c.status === 'rejected' || c.status === 'injected'}
                  onClick={() => void decide(c.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="admin-btn-danger text-xs"
                  disabled={!!busy || c.status === 'rejected'}
                  onClick={() => void decide(c.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
