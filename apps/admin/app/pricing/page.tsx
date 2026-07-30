'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SA_PRICING, PRICING_SKUS } from '@e3lani/types';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatMoney } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

type PriceDraft = Record<string, number>;

export default function PricingPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draft, setDraft] = useState<PriceDraft>(() =>
    Object.fromEntries(PRICING_SKUS.map((sku) => [sku, DEFAULT_SA_PRICING[sku].amount])),
  );
  const [saving, setSaving] = useState(false);

  function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api
      .adminPricing()
      .then((rows) => {
        setVersions(rows);
        const active = rows.find((row: any) => row.isActive);
        if (active?.items?.length) {
          const next: PriceDraft = { ...draft };
          for (const item of active.items) {
            next[item.sku] = Number(item.amount);
          }
          setDraft(next);
        }
      })
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.adminUpdatePricing({
        items: PRICING_SKUS.map((sku) => ({
          sku,
          amount: Number(draft[sku]),
          labelAr: DEFAULT_SA_PRICING[sku].labelAr,
          labelEn: DEFAULT_SA_PRICING[sku].labelEn,
          durationDays: DEFAULT_SA_PRICING[sku].durationDays ?? null,
        })),
      });
      setSuccess('تم حفظ نسخة تسعير جديدة وتفعيلها.');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="التسعير"
        description="الأسعار تُدار من هنا فقط — لا تُثبَّت في العملاء. النشر مجاني حاليًا (FREE_LAUNCH) مع حفظ الأسعار للتفعيل لاحقًا."
      />
      <ErrorMessage message={error} />
      {success ? <p className="success">{success}</p> : null}

      <div className="panel stack">
        <strong>تعديل الأسعار (ريال سعودي)</strong>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>البند</th>
                <th>السعر</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_SKUS.map((sku) => (
                <tr key={sku}>
                  <td>{sku}</td>
                  <td>{DEFAULT_SA_PRICING[sku].labelAr}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft[sku] ?? 0}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [sku]: Number(e.target.value) }))
                      }
                      style={{ width: 100 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'جاري الحفظ...' : 'حفظ نسخة تسعير جديدة'}
        </button>
      </div>

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
