'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type AiRequest = {
  id: string;
  userId: string | null;
  contributionId: string | null;
  provider: string;
  prompt: string;
  status: string;
  latencyMs: number | null;
  createdAt: string;
};

type Summary = {
  total: number;
  byProvider: Record<string, number>;
  avgLatencyMs: number | null;
  estimatedCostUsd: number;
  note: string;
};

export default function AiPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [requests, setRequests] = useState<AiRequest[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ requests: AiRequest[]; summary: Summary }>('/admin/ai-requests', token)
      .then((d) => {
        setRequests(d.requests);
        setSummary(d.summary);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [token]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">AI monitor</h1>
        <p className="text-sm text-fg-muted">Request logs from ai_requests · cost placeholder</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="admin-card">
            <div className="text-xs text-fg-muted">Requests</div>
            <div className="font-display text-2xl">{summary.total}</div>
          </div>
          <div className="admin-card">
            <div className="text-xs text-fg-muted">Avg latency</div>
            <div className="font-display text-2xl">
              {summary.avgLatencyMs != null ? `${summary.avgLatencyMs}ms` : '—'}
            </div>
          </div>
          <div className="admin-card">
            <div className="text-xs text-fg-muted">Est. cost</div>
            <div className="font-display text-2xl">${summary.estimatedCostUsd.toFixed(2)}</div>
            <div className="mt-1 text-xs text-fg-muted">{summary.note}</div>
          </div>
        </div>
      )}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Prompt</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.provider}</td>
                <td>{r.status}</td>
                <td className="text-xs text-fg-muted">{r.latencyMs != null ? `${r.latencyMs}ms` : '—'}</td>
                <td className="max-w-md truncate text-xs text-fg-muted">{r.prompt}</td>
                <td className="text-xs text-fg-muted">{r.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
