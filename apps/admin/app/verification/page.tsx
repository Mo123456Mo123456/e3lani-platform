'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function VerificationPage() {
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setItems(await api.adminVerification());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    await api.adminDecideVerification(id, { status, notes: notes[id] });
    await load();
  }

  return (
    <div className="stack">
      <PageHeader title="توثيق المعلنين" description="طلبات UserVerification بانتظار قرار الدعم أو المراجعة." />
      <ErrorMessage message={error} />
      {items.map((item) => (
        <div key={item.id} className="panel stack">
          <div className="toolbar">
            <strong>{item.user?.displayName || item.user?.brandProfile?.nameAr || item.user?.phone}</strong>
            <StatusBadge>{item.status}</StatusBadge>
            {item.kind ? <StatusBadge>{item.kind}</StatusBadge> : null}
          </div>
          <div className="muted">
            {item.user?.phone} · {formatDate(item.updatedAt)}
          </div>
          {item.notes ? <p>{item.notes}</p> : null}
          <textarea
            className="textarea"
            placeholder="ملاحظات قرار التوثيق"
            value={notes[item.id] ?? ''}
            onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))}
          />
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => decide(item.id, 'APPROVED')}>
              اعتماد التوثيق
            </button>
            <button className="btn btn-dark" onClick={() => decide(item.id, 'REJECTED')}>
              رفض
            </button>
          </div>
        </div>
      ))}
      {items.length === 0 && !error ? <EmptyState>لا توجد طلبات توثيق بانتظار المراجعة.</EmptyState> : null}
    </div>
  );
}
