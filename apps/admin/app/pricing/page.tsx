'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatMoney } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function PricingPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api.adminPricing().then(setVersions).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="stack">
      <PageHeader title="التسعير" description="بنود التسعير النشطة والمحافظة من قاعدة البيانات." />
      <ErrorMessage message={error} />
      {versions.map((version) => (
        <div key={version.id} className="panel stack">
          <div className="toolbar">
            <strong>{version.code}</strong>
            {version.isActive ? <StatusBadge>ACTIVE</StatusBadge> : null}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>العنوان</th>
                  <th>السعر</th>
                  <th>المدة</th>
                  <th>الدولة</th>
                </tr>
              </thead>
              <tbody>
                {(version.items || []).map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.sku}</td>
                    <td>
                      <strong>{item.labelAr}</strong>
                      <div className="muted">{item.labelEn}</div>
                    </td>
                    <td>{formatMoney(item.amount, item.currency)}</td>
                    <td>{item.durationDays ? `${item.durationDays} يوم` : '-'}</td>
                    <td>{item.countryCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {versions.length === 0 && !error ? <EmptyState>لا توجد بنود تسعير.</EmptyState> : null}
    </div>
  );
}
