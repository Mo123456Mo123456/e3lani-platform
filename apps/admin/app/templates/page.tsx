'use client';

import { useEffect, useState } from 'react';
import { ErrorMessage, PageHeader, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function TemplatesPage() {
  const [value, setValue] = useState('{}');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api
      .adminTemplates()
      .then((setting) => {
        setValue(JSON.stringify(setting.value ?? {}, null, 2));
        setUpdatedAt(setting.updatedAt);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function save() {
    setMessage('');
    const parsed = JSON.parse(value);
    const saved = await api.adminUpdateTemplates(parsed);
    setUpdatedAt(saved.updatedAt);
    setMessage('تم حفظ قوالب الإشعارات.');
  }

  return (
    <div className="stack">
      <PageHeader
        title="قوالب الإشعارات"
        description="واجهة SystemSetting-backed لقوالب الإشعارات حتى تكتمل محررات المحتوى."
      />
      <ErrorMessage message={error} />
      {message ? <p className="badge">{message}</p> : null}
      <div className="panel stack">
        <div className="muted">آخر تحديث: {formatDate(updatedAt)}</div>
        <textarea className="textarea" style={{ minHeight: 360, direction: 'ltr' }} value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn btn-primary" onClick={() => save().catch((e) => setError((e as Error).message))}>
          حفظ JSON
        </button>
      </div>
    </div>
  );
}
