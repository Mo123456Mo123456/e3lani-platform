'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setReports(await api.adminReports());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function resolve(id: string) {
    await api.adminResolveReport(id, {
      status: 'RESOLVED',
      resolution: resolution[id] || 'تمت معالجة البلاغ من لوحة الإدارة',
    });
    await load();
  }

  return (
    <div className="stack">
      <PageHeader title="البلاغات" description="بلاغات المستخدمين على الإعلانات مع إجراء حل مباشر." />
      <ErrorMessage message={error} />
      {reports.map((report) => (
        <div key={report.id} className="panel stack">
          <div className="toolbar">
            <strong>{report.ad?.currentRevision?.title || report.adId}</strong>
            <StatusBadge>{report.status}</StatusBadge>
            <StatusBadge>{report.reason}</StatusBadge>
          </div>
          <div className="muted">
            بواسطة {report.reporter?.displayName || report.reporter?.phone || report.reporterId} ·{' '}
            {formatDate(report.createdAt)}
          </div>
          {report.details ? <p>{report.details}</p> : null}
          {report.resolution ? <p className="muted">القرار: {report.resolution}</p> : null}
          <textarea
            className="textarea"
            placeholder="نص معالجة البلاغ"
            value={resolution[report.id] ?? ''}
            onChange={(e) => setResolution((current) => ({ ...current, [report.id]: e.target.value }))}
          />
          <button className="btn btn-primary" onClick={() => resolve(report.id)} disabled={report.status === 'RESOLVED'}>
            حل البلاغ
          </button>
        </div>
      ))}
      {reports.length === 0 && !error ? <EmptyState>لا توجد بلاغات.</EmptyState> : null}
    </div>
  );
}
