'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ logs: AuditLog[] }>('/admin/audit', token, { limit: '200' })
      .then((d) => setLogs(d.logs.slice().reverse()))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [token]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Audit logs</h1>
        <p className="text-sm text-fg-muted">Privileged actions trail</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Details</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs text-[var(--color-accent)]">{l.action}</td>
                <td className="font-mono text-xs">{l.actorId?.slice(0, 10) || '—'}</td>
                <td className="text-xs">
                  {l.resourceType}/{l.resourceId?.slice(0, 10)}
                </td>
                <td className="max-w-xs truncate font-mono text-xs text-fg-muted">
                  {l.details ? JSON.stringify(l.details) : '—'}
                </td>
                <td className="text-xs text-fg-muted">{l.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
