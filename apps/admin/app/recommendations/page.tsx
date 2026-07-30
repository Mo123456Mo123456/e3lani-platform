'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

const LABELS: Record<string, string> = {
  contentBased: 'تصفية بالمحتوى',
  collaborative: 'تصفية تعاونية',
  popularity: 'الشعبية والترند',
  location: 'الموقع',
  recency: 'الحداثة',
  featuredBoost: 'رفع المميز',
  sponsoredBoost: 'رفع المموّل',
  maxPaidShare: 'سقف الإعلانات المدفوعة',
  recencyHalfLifeHours: 'نصف عمر الحداثة (ساعات)',
  collaborativeMinInteractions: 'حد تفعيل التعاوني',
  candidatePoolSize: 'حجم مرشحي التسجيل',
  cacheTtlSeconds: 'TTL الكاش (ث)',
};

export default function RecommendationsAdminPage() {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [perf, setPerf] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    Promise.all([api.recommendationWeights(), api.recommendationPerformance()])
      .then(([w, p]) => {
        setWeights(w);
        setPerf(p);
      })
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const next = await api.updateRecommendationWeights(weights);
      setWeights(next as Record<string, number>);
      setSuccess('تم حفظ أوزان التوصيات وتحديث الكاش.');
      const p = await api.recommendationPerformance();
      setPerf(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="التوصيات الذكية — لك"
        description="نظام هجين (محتوى + تعاوني + شعبية + موقع + حداثة + قواعد أعمال بسقف شفاف). الأوزان قابلة للتعديل هنا."
      />
      <ErrorMessage message={error} />
      {success ? <p className="success">{success}</p> : null}

      {perf ? (
        <div className="panel stack">
          <strong>أداء آخر {perf.windowDays} أيام</strong>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>القسم</th>
                  <th>الظهور/المشاهدات</th>
                  <th>التفاعلات</th>
                  <th>معدل التفاعل</th>
                </tr>
              </thead>
              <tbody>
                {(['forYou', 'nearby', 'latest'] as const).map((tab) => {
                  const row = perf.tabs?.[tab];
                  return (
                    <tr key={tab}>
                      <td>{tab === 'forYou' ? 'لك' : tab === 'nearby' ? 'قريب منك' : 'الأحدث'}</td>
                      <td>{row?.impressions ?? 0}</td>
                      <td>{row?.engagements ?? 0}</td>
                      <td>{((row?.engagementRate ?? 0) * 100).toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            المحرك: {perf.adapter} · المصادر:{' '}
            {(perf.engagementBySource ?? [])
              .map((s: any) => `${s.source}=${s.engagements}`)
              .join(' · ') || 'لا بيانات بعد'}
          </p>
        </div>
      ) : null}

      <div className="panel stack">
        <strong>أوزان الخوارزمية</strong>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المعامل</th>
                <th>القيمة</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(LABELS).map((key) => (
                <tr key={key}>
                  <td>
                    <strong>{LABELS[key]}</strong>
                    <div className="muted">{key}</div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step={key.includes('Hours') || key.includes('Size') || key.includes('Ttl') || key.includes('Min') ? 1 : 0.01}
                      value={weights[key] ?? 0}
                      onChange={(e) =>
                        setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      style={{ width: 120 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'جاري الحفظ...' : 'حفظ الأوزان'}
        </button>
        <p className="muted">
          سقف الإعلانات المدفوعة (`maxPaidShare`) يمنع طغيان الممول على التوصيات الطبيعية.
        </p>
      </div>

      {!perf && !error ? <EmptyState>لا توجد بيانات أداء بعد.</EmptyState> : null}
    </div>
  );
}
