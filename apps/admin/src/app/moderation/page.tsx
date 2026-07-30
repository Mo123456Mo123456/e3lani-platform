'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type Report = {
  id: string;
  contributionId: string;
  status: string;
  reasons: string[] | null;
  score: number;
  reviewerId: string | null;
  createdAt: string;
};

export default function ModerationPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ reports: Report[] }>('/admin/moderation', token)
      .then((d) => setReports(d.reports))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [token]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Moderation</h1>
        <p className="text-sm text-fg-muted">Automated and manual moderation reports</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Score</th>
              <th>Contribution</th>
              <th>Reasons</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <span
                    className={
                      r.status === 'approved'
                        ? 'text-success'
                        : r.status === 'rejected'
                          ? 'text-danger'
                          : 'text-warm'
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="font-mono text-xs">{r.score.toFixed(2)}</td>
                <td className="font-mono text-xs">{r.contributionId.slice(0, 12)}…</td>
                <td className="text-xs text-fg-muted">{(r.reasons || []).join(', ') || '—'}</td>
                <td className="text-xs text-fg-muted">{r.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
