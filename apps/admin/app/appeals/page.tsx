'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

const statuses = ['UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'CLOSED'];

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setAppeals(await api.adminAppeals());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function decide(id: string, status: string) {
    await api.adminDecideAppeal(id, {
      status,
      decisionNote: notes[id] || `تحديث الاعتراض إلى ${status}`,
    });
    await load();
  }

  return (
    <div className="stack">
      <PageHeader title="الاعتراضات" description="اعتراضات المستخدمين على قرارات البلاغات أو المراجعة." />
      <ErrorMessage message={error} />
      {appeals.map((appeal) => (
        <div key={appeal.id} className="panel stack">
          <div className="toolbar">
            <strong>{appeal.ad?.currentRevision?.title || appeal.adId}</strong>
            <StatusBadge>{appeal.status}</StatusBadge>
            {appeal.report ? <StatusBadge>بلاغ: {appeal.report.reason}</StatusBadge> : null}
          </div>
          <div className="muted">
            {appeal.user?.displayName || appeal.user?.phone || appeal.userId} · {formatDate(appeal.createdAt)}
          </div>
          <p>
            <strong>{appeal.reason}</strong>
            {appeal.details ? ` — ${appeal.details}` : ''}
          </p>
          {appeal.decisionNote ? <p className="muted">قرار سابق: {appeal.decisionNote}</p> : null}
          <textarea
            className="textarea"
            placeholder="ملاحظة القرار"
            value={notes[appeal.id] ?? ''}
            onChange={(e) => setNotes((current) => ({ ...current, [appeal.id]: e.target.value }))}
          />
          <div className="toolbar">
            {statuses.map((status) => (
              <button key={status} className="btn btn-ghost" onClick={() => decide(appeal.id, status)}>
                {status}
              </button>
            ))}
          </div>
        </div>
      ))}
      {appeals.length === 0 && !error ? <EmptyState>لا توجد اعتراضات.</EmptyState> : null}
    </div>
  );
}
