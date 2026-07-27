'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api.adminAudit().then(setLogs).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="stack">
      <PageHeader title="سجل التدقيق" description="آخر أحداث AuditLog للأمان ومراجعة العمليات." />
      <ErrorMessage message={error} />
      {logs.map((log) => (
        <div key={log.id} className="panel stack">
          <div className="toolbar">
            <strong>{log.action}</strong>
            <StatusBadge>{log.entityType}</StatusBadge>
            <StatusBadge>{formatDate(log.createdAt)}</StatusBadge>
          </div>
          <div className="muted">
            actor: {log.actor?.displayName || log.actor?.phone || log.actorId || 'system'} · entity: {log.entityId}
          </div>
          {log.reason ? <p>{log.reason}</p> : null}
          <div className="grid">
            <pre className="json-box">{JSON.stringify({ before: log.before }, null, 2)}</pre>
            <pre className="json-box">{JSON.stringify({ after: log.after }, null, 2)}</pre>
          </div>
        </div>
      ))}
      {logs.length === 0 && !error ? <EmptyState>لا توجد أحداث تدقيق.</EmptyState> : null}
    </div>
  );
}
