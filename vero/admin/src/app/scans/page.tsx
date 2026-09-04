'use client';

import { useState } from 'react';
import { api, type Paged, type Scan } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  REASON_AR,
  StatusPill,
  fmtDateTime,
  useData,
} from '@/components/ui';

export default function ScansPage() {
  const [status, setStatus] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Scan | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (status) params.set('status', status);
  if (reviewStatus) params.set('reviewStatus', reviewStatus);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const list = useData<Paged<Scan>>(() => api(`/v1/scans?${params}`), [
    status,
    reviewStatus,
    from,
    to,
    page,
  ]);
  // التحقق من السلسلة متاح للمدير فقط؛ للأدوار الأخرى نتجاوزه بهدوء بدل إظهار خطأ صلاحيات
  type ChainResult = { ok: boolean; checked: number; brokenAt: unknown[] };
  const chain = useData<ChainResult>(() =>
    api<ChainResult>('/v1/scans/chain/verify').catch(
      (): ChainResult => ({ ok: true, checked: 0, brokenAt: [] }),
    ),
  );

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <Shell title="الزيارات وسلسلة الإثبات">
      {chain.data && chain.data.checked > 0 && (
        <div className={`alert ${chain.data.ok ? 'ok' : 'error'}`}>
          <span>{chain.data.ok ? '🔒' : '⚠'}</span>
          <div>
            {chain.data.ok ? (
              <>
                سلسلة الإثبات سليمة — تم التحقق من{' '}
                <b className="num">{chain.data.checked}</b> زيارة بلا أي تعديل غير مصرّح به.
              </>
            ) : (
              <>
                <b>تحذير:</b> اكتُشف عبث في سلسلة الإثبات عند{' '}
                <b className="num">{chain.data.brokenAt.length}</b> سجل. هذا يعني تعديلًا مباشرًا
                على قاعدة البيانات خارج النظام.
              </>
            )}
          </div>
        </div>
      )}

      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          <option value="VERIFIED">موثّقة</option>
          <option value="SUSPICIOUS">تحتاج مراجعة</option>
        </select>
        <select
          value={reviewStatus}
          onChange={(e) => {
            setReviewStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل حالات المراجعة</option>
          <option value="PENDING">بانتظار المراجعة</option>
          <option value="ACCEPTED">مقبولة</option>
          <option value="REJECTED">مرفوضة</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="spacer" />
        <button className="btn sm" onClick={list.reload}>
          تحديث
        </button>
      </div>

      <section className="card">
        {list.error != null ? (
          <div style={{ padding: 16 }}>
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading ? (
          <div style={{ padding: 16 }}>
            <Loading rows={8} />
          </div>
        ) : !list.data || list.data.items.length === 0 ? (
          <Empty icon="✅" title="لا توجد زيارات مطابقة" />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الحاوية</th>
                    <th>الوقت</th>
                    <th>العامل</th>
                    <th>السيارة</th>
                    <th>المسافة</th>
                    <th>الحالة</th>
                    <th>محتسبة</th>
                    <th>المراجعة</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((s) => (
                    <tr key={s.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {s.binPublicId}
                      </td>
                      <td className="hint">
                        {fmtDateTime(s.scannedAt)}
                        {s.offline && (
                          <span className="pill info" style={{ marginInlineStart: 6 }}>
                            أوفلاين
                          </span>
                        )}
                      </td>
                      <td>{s.workerName ?? '—'}</td>
                      <td>{s.vehicleNo ?? '—'}</td>
                      <td className="num">
                        {Math.round(s.distanceM)} / {s.radiusM} م
                      </td>
                      <td>
                        <StatusPill status={s.status} />
                      </td>
                      <td>{s.counted ? '✓' : '—'}</td>
                      <td>
                        <StatusPill status={s.reviewStatus} />
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        <button className="btn sm" onClick={() => setSelected(s)}>
                          الإثبات
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderTop: '1px solid var(--line)',
              }}
            >
              <span className="hint">
                إجمالي <span className="num">{list.data.total}</span>
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                السابق
              </button>
              <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                التالي
              </button>
            </div>
          </>
        )}
      </section>

      {selected && (
        <ProofModal
          scan={selected}
          onClose={() => setSelected(null)}
          onReviewed={() => {
            setSelected(null);
            list.reload();
            chain.reload();
          }}
        />
      )}
    </Shell>
  );
}

function ProofModal({
  scan,
  onClose,
  onReviewed,
}: {
  scan: Scan;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const review = async (reviewStatus: 'ACCEPTED' | 'REJECTED') => {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/scans/${scan.id}/review`, {
        method: 'POST',
        body: { reviewStatus, note: note || undefined },
      });
      onReviewed();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const rows: [string, React.ReactNode][] = [
    ['الحاوية', <span key="b" className="mono">{scan.binPublicId}</span>],
    ['وصف الحاوية', scan.binName ?? '—'],
    ['وقت المسح على الجهاز', fmtDateTime(scan.scannedAt)],
    ['وقت الوصول للخادم', fmtDateTime(scan.receivedAt)],
    ['يوم الخدمة', <span key="d" className="num">{scan.serviceDay}</span>],
    ['العامل', scan.workerName ?? '—'],
    ['السيارة', scan.vehicleNo ?? '—'],
    [
      'موقع المسح',
      <span key="l" className="mono">
        {scan.lat.toFixed(6)}, {scan.lon.toFixed(6)}
      </span>,
    ],
    [
      'المسافة إلى الحاوية',
      <span key="m" className="num">
        {Math.round(scan.distanceM)} متر (النطاق المسموح {scan.radiusM} م)
      </span>,
    ],
    ['دقة GPS', scan.accuracyM != null ? `${Math.round(scan.accuracyM)} م` : '—'],
    ['وضع التسجيل', scan.offline ? 'أوفلاين ثم مزامنة' : 'متصل مباشرة'],
    ['الحالة', <StatusPill key="s" status={scan.status} />],
    ['محتسبة كزيارة اليوم', scan.counted ? 'نعم' : 'لا'],
  ];

  return (
    <Modal
      title="سجل إثبات الزيارة"
      onClose={onClose}
      footer={
        scan.reviewStatus === 'PENDING' ? (
          <>
            <button className="btn primary" onClick={() => review('ACCEPTED')} disabled={busy}>
              قبول الزيارة
            </button>
            <button className="btn danger" onClick={() => review('REJECTED')} disabled={busy}>
              رفض الزيارة
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>
              لاحقًا
            </button>
          </>
        ) : (
          <button className="btn" onClick={onClose}>
            إغلاق
          </button>
        )
      }
    >
      {error != null && <ErrorBox error={error} />}

      <table style={{ marginBottom: 14 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ color: 'var(--text-muted)', width: '45%' }}>{k}</td>
              <td style={{ fontWeight: 500 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {scan.reasons.length > 0 && (
        <div className="alert warn">
          <span>⚠</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>أسباب الاشتباه</div>
            {scan.reasons.map((r) => REASON_AR[r] ?? r).join('، ')}
          </div>
        </div>
      )}

      <div className="alert info">
        <span>🔗</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>
            سلسلة الإثبات — الحلقة رقم <span className="num">{scan.chainSeq}</span>
          </div>
          <div className="mono" style={{ wordBreak: 'break-all', fontSize: 10.5 }}>
            التجزئة: {scan.proofHash}
          </div>
          <div className="mono" style={{ wordBreak: 'break-all', fontSize: 10.5, opacity: 0.75 }}>
            السابقة: {scan.prevHash ?? '— بداية السلسلة —'}
          </div>
        </div>
      </div>

      {scan.reviewStatus === 'PENDING' && (
        <Field label="ملاحظة المراجعة" hint="تُحفظ في سجل العمليات مع اسمك ووقت المراجعة">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}

      {scan.reviewNote && (
        <Field label="ملاحظة سابقة">
          <div className="hint">{scan.reviewNote}</div>
        </Field>
      )}
    </Modal>
  );
}
