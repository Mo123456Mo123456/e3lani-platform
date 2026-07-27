'use client';

import { useEffect, useState } from 'react';
import { ErrorMessage, PageHeader, StatusBadge } from '../../components/AdminUi';
import { api, apiBaseUrl } from '../../lib/api';

export default function HealthPage() {
  const [health, setHealth] = useState<unknown>(null);
  const [ready, setReady] = useState<unknown>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([api.health(), api.healthReady()])
      .then(([healthResult, readyResult]) => {
        if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
        if (readyResult.status === 'fulfilled') setReady(readyResult.value);
        const failures = [healthResult, readyResult].filter((result) => result.status === 'rejected');
        if (failures.length) setError('تعذر تحميل بعض فحوصات الصحة.');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="stack">
      <PageHeader title="صحة النظام" description={`فحوصات API health و readiness من ${apiBaseUrl}`} />
      <ErrorMessage message={error} />
      <div className="grid">
        <HealthCard title="/health" data={health} />
        <HealthCard title="/health/ready" data={ready} />
      </div>
    </div>
  );
}

function HealthCard({ title, data }: { title: string; data: unknown }) {
  const status =
    typeof data === 'object' && data && 'status' in data ? String((data as { status: unknown }).status) : 'loading';
  return (
    <div className="panel stack">
      <div className="toolbar">
        <strong>{title}</strong>
        <StatusBadge>{status}</StatusBadge>
      </div>
      <pre className="json-box">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
