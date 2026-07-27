'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';
import { ErrorMessage, PageHeader } from '../components/AdminUi';

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function AdminHome() {
  const [kpis, setKpis] = useState<Kpi[]>([
    { label: 'بانتظار المراجعة', value: '-' },
    { label: 'الطلبات', value: '-' },
    { label: 'معاملات الدفع', value: '-' },
    { label: 'بلاغات مفتوحة', value: '-' },
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول لعرض مؤشرات التشغيل.');
      return;
    }

    Promise.allSettled([
      api.adminReviewQueue(),
      api.adminOrders(),
      api.adminPayments(),
      api.adminReports(),
    ])
      .then(([queue, orders, payments, reports]) => {
        const reportRows = reports.status === 'fulfilled' ? reports.value : [];
        setKpis([
          {
            label: 'بانتظار المراجعة',
            value: queue.status === 'fulfilled' ? queue.value.length : 'تعذر',
            hint: queue.status === 'rejected' ? 'فشل تحميل قائمة المراجعة' : undefined,
          },
          {
            label: 'الطلبات',
            value: orders.status === 'fulfilled' ? orders.value.length : 'تعذر',
            hint: orders.status === 'rejected' ? 'فشل تحميل الطلبات' : undefined,
          },
          {
            label: 'معاملات الدفع',
            value: payments.status === 'fulfilled' ? payments.value.length : 'تعذر',
            hint: payments.status === 'rejected' ? 'فشل تحميل المدفوعات' : undefined,
          },
          {
            label: 'بلاغات مفتوحة',
            value: reports.status === 'fulfilled'
              ? reportRows.filter((report) => report.status === 'OPEN').length
              : 'تعذر',
            hint: reports.status === 'rejected' ? 'فشل تحميل البلاغات' : undefined,
          },
        ]);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="stack">
      <PageHeader
        title="لوحة المتابعة"
        description="مؤشرات تشغيل سريعة من واجهات الإدارة، مع استمرار العرض إذا تعذر أحد المصادر."
      />
      <ErrorMessage message={error} />
      <div className="grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="panel">
            <strong style={{ fontSize: 30 }}>{kpi.value}</strong>
            <div className="muted">{kpi.label}</div>
            {kpi.hint ? <small className="error">{kpi.hint}</small> : null}
          </div>
        ))}
        <div className="panel">
          <strong style={{ fontSize: 30 }}>Sandbox</strong>
          <div className="muted">وضع الدفع الافتراضي</div>
        </div>
      </div>
    </div>
  );
}
