'use client';

import { useEffect, useState } from 'react';
import { ErrorMessage, PageHeader, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function FlagsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api
      .adminFlags()
      .then((setting) => {
        setFlags(setting.value ?? {});
        setUpdatedAt(setting.updatedAt);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function save(next: Record<string, boolean>) {
    setFlags(next);
    const saved = await api.adminUpdateFlags(next);
    setUpdatedAt(saved.updatedAt);
    setMessage('تم حفظ Feature Flags.');
  }

  return (
    <div className="stack">
      <PageHeader title="Feature Flags" description="إعدادات SystemSetting-backed لتفعيل أو تعطيل مسارات التشغيل." />
      <ErrorMessage message={error} />
      {message ? <p className="badge">{message}</p> : null}
      <div className="panel stack">
        <div className="muted">آخر تحديث: {formatDate(updatedAt)}</div>
        {Object.entries(flags).map(([key, enabled]) => (
          <label key={key} className="toolbar" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{key}</strong>
              <span className="muted"> · {enabled ? 'مفعل' : 'معطل'}</span>
            </span>
            <button
              className={enabled ? 'btn btn-primary' : 'btn btn-ghost'}
              onClick={() => save({ ...flags, [key]: !enabled }).catch((e) => setError((e as Error).message))}
            >
              {enabled ? 'إيقاف' : 'تفعيل'}
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
