'use client';

import Link from 'next/link';
import { api, type AttentionItem, type DashboardStats, type LiveVehicle } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  ATTENTION_AR,
  Empty,
  ErrorBox,
  Loading,
  Stat,
  fmtRelative,
  useData,
} from '@/components/ui';

export default function DashboardPage() {
  const stats = useData<DashboardStats>(() => api('/v1/dashboard'));
  const attention = useData<{ items: AttentionItem[]; counts: Record<string, number> }>(() =>
    api('/v1/attention?perKind=8'),
  );
  const live = useData<{ items: LiveVehicle[] }>(() => api('/v1/routes/live'));

  return (
    <Shell title="الرئيسية">
      {stats.error != null ? (
        <ErrorBox error={stats.error} onRetry={stats.reload} />
      ) : stats.loading ? (
        <Loading rows={3} />
      ) : (
        stats.data && <Overview d={stats.data} />
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.35fr 1fr', marginTop: 18 }}>
        <section className="card">
          <div className="card-head">
            <h2>تحتاج انتباه</h2>
            <div className="spacer" />
            <Link href="/attention" className="btn sm">
              عرض الكل
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {attention.error != null ? (
              <div style={{ padding: 16 }}>
                <ErrorBox error={attention.error} onRetry={attention.reload} />
              </div>
            ) : attention.loading ? (
              <div style={{ padding: 16 }}>
                <Loading rows={4} />
              </div>
            ) : !attention.data || attention.data.items.length === 0 ? (
              <Empty icon="✅" title="لا توجد استثناءات" hint="كل شيء يسير كما هو مخطط اليوم" />
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {attention.data.items.slice(0, 10).map((it, i) => (
                      <tr key={`${it.entityId}-${i}`}>
                        <td style={{ width: 1, whiteSpace: 'nowrap' }}>
                          <span
                            className={`pill ${
                              it.severity === 'HIGH'
                                ? 'bad'
                                : it.severity === 'MEDIUM'
                                  ? 'warn'
                                  : 'muted'
                            }`}
                          >
                            {ATTENTION_AR[it.kind] ?? it.kind}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{it.title}</div>
                          <div className="hint">{it.detail}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>السيارات الآن</h2>
            <div className="spacer" />
            <Link href="/map" className="btn sm">
              الخريطة
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {live.error != null ? (
              <div style={{ padding: 16 }}>
                <ErrorBox error={live.error} onRetry={live.reload} />
              </div>
            ) : live.loading ? (
              <div style={{ padding: 16 }}>
                <Loading rows={4} />
              </div>
            ) : !live.data || live.data.items.length === 0 ? (
              <Empty icon="🚛" title="لا توجد سيارات مسجّلة" hint="أضف سياراتك من قسم السيارات" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>السيارة</th>
                      <th>السائق</th>
                      <th>تم اليوم</th>
                      <th>آخر اتصال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.data.items.map((v) => (
                      <tr key={v.vehicleId}>
                        <td>
                          <span className="dot" style={{ background: v.online ? '#16a34a' : '#9ca3af' }} />{' '}
                          {v.internalNo}
                        </td>
                        <td>{v.workerName ?? '—'}</td>
                        <td className="num">{v.doneToday}</td>
                        <td className="hint">{fmtRelative(v.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Overview({ d }: { d: DashboardStats }) {
  return (
    <>
      <div className="stats">
        <Stat label="إجمالي نقاط الخدمة" value={d.totalBins} tone="primary" hint={`الفعّالة: ${d.activeBins}`} />
        <Stat label="تم اليوم" value={d.servicedToday} tone="ok" />
        <Stat label="المتبقي" value={d.remaining} tone={d.remaining > 0 ? 'warn' : 'ok'} />
        <Stat label="تحتاج مراجعة" value={d.needsReview} tone={d.needsReview > 0 ? 'bad' : ''} />
        <Stat label="السيارات النشطة" value={d.activeVehicles} hint={`غير متصلة: ${d.offlineVehicles}`} />
        <Stat label="عمليات أوفلاين اليوم" value={d.offlineScansToday} hint="تمت مزامنتها" />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>نسبة الإنجاز اليوم</span>
            <span
              className="num"
              style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}
            >
              {d.completionRate}%
            </span>
            <div className="spacer" style={{ flex: 1 }} />
            <span className="hint">
              يوم الخدمة: <span className="num">{d.serviceDay}</span>
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${Math.min(100, d.completionRate)}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}
