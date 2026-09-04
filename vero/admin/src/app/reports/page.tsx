'use client';

import { useState } from 'react';
import { API_URL, api, download, type ReportSummary } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { Empty, ErrorBox, Field, Loading, Modal, fmtDateTime, useData } from '@/components/ui';

interface SlaContract {
  id: string;
  name: string;
  clientName: string | null;
  requiredVisitsPerDay: number;
  scopeSector: string | null;
  activeFrom: string;
  isActive: boolean;
}

const KIND_AR: Record<string, string> = {
  DAILY: 'يومي',
  WEEKLY: 'أسبوعي',
  MONTHLY: 'شهري',
  CUSTOM: 'مخصص',
};

const today = () => new Date().toLocaleDateString('en-CA');
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toLocaleDateString('en-CA');

export default function ReportsPage() {
  const list = useData<{ items: ReportSummary[] }>(() => api('/v1/reports'));
  const contracts = useData<{ items: SlaContract[] }>(() => api('/v1/sla-contracts'));
  const [creating, setCreating] = useState(false);
  const [newContract, setNewContract] = useState(false);

  return (
    <Shell title="التقارير وإثبات العقد">
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setNewContract(true)}>
          + عقد SLA
        </button>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + تقرير جديد
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section className="card">
          <div className="card-head">
            <h2>التقارير الصادرة</h2>
          </div>
          {list.error != null ? (
            <div style={{ padding: 16 }}>
              <ErrorBox error={list.error} onRetry={list.reload} />
            </div>
          ) : list.loading ? (
            <div style={{ padding: 16 }}>
              <Loading rows={5} />
            </div>
          ) : !list.data || list.data.items.length === 0 ? (
            <Empty
              icon="📄"
              title="لا توجد تقارير بعد"
              hint="أنشئ تقريرًا أسبوعيًا أو شهريًا لتقديمه للبلدية أو الجهة المتعاقدة"
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>رقم التقرير</th>
                    <th>النوع</th>
                    <th>الفترة</th>
                    <th>نسبة الالتزام</th>
                    <th>أصدره</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {r.reportNo}
                      </td>
                      <td>{KIND_AR[r.kind] ?? r.kind}</td>
                      <td className="num hint">
                        {r.periodStart} → {r.periodEnd}
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            r.complianceRate >= 95 ? 'ok' : r.complianceRate >= 80 ? 'warn' : 'bad'
                          }`}
                        >
                          {r.complianceRate}%
                        </span>
                      </td>
                      <td className="hint">{r.createdByName ?? '—'}</td>
                      <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn sm"
                          onClick={() => download(`/v1/reports/${r.id}.pdf`, `${r.reportNo}.pdf`)}
                        >
                          PDF
                        </button>{' '}
                        <button
                          className="btn sm"
                          onClick={() => download(`/v1/reports/${r.id}.xlsx`, `${r.reportNo}.xlsx`)}
                        >
                          Excel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>عقود SLA</h2>
          </div>
          <div className="card-body" style={{ padding: contracts.data?.items.length ? 0 : 16 }}>
            {contracts.loading ? (
              <Loading rows={3} />
            ) : !contracts.data || contracts.data.items.length === 0 ? (
              <Empty
                icon="📑"
                title="لا توجد عقود"
                hint="عرّف متطلبات العقد ليحسب النظام نسبة الالتزام تلقائيًا"
              />
            ) : (
              <table>
                <tbody>
                  {contracts.data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div className="hint">
                          {c.clientName ?? 'بلا جهة محددة'} ·{' '}
                          <span className="num">{c.requiredVisitsPerDay}</span> زيارة/يوم
                          {c.scopeSector ? ` · ${c.scopeSector}` : ''}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {creating && (
        <CreateReport
          contracts={contracts.data?.items ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}

      {newContract && (
        <CreateContract
          onClose={() => setNewContract(false)}
          onDone={() => {
            setNewContract(false);
            contracts.reload();
          }}
        />
      )}
    </Shell>
  );
}

function CreateReport({
  contracts,
  onClose,
  onDone,
}: {
  contracts: SlaContract[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('WEEKLY');
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());
  const [slaContractId, setSla] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<{
    id: string;
    reportNo: string;
    verifyToken: string;
    payload: { sla: { complianceRate: number; verified: number; missed: number; suspicious: number } };
  } | null>(null);

  const applyKind = (k: typeof kind) => {
    setKind(k);
    if (k === 'DAILY') {
      setFrom(today());
      setTo(today());
    } else if (k === 'WEEKLY') {
      setFrom(daysAgo(6));
      setTo(today());
    } else if (k === 'MONTHLY') {
      setFrom(daysAgo(29));
      setTo(today());
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<typeof created>('/v1/reports', {
        method: 'POST',
        body: { kind, from, to, slaContractId: slaContractId || null },
      });
      setCreated(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="إنشاء تقرير"
      onClose={onClose}
      footer={
        created ? (
          <>
            <button
              className="btn primary"
              onClick={() => download(`/v1/reports/${created.id}.pdf`, `${created.reportNo}.pdf`)}
            >
              تنزيل PDF
            </button>
            <button
              className="btn"
              onClick={() => download(`/v1/reports/${created.id}.xlsx`, `${created.reportNo}.xlsx`)}
            >
              تنزيل Excel
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={onDone}>
              تم
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={create} disabled={busy}>
              {busy ? 'جارٍ الحساب…' : 'إنشاء'}
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>
              إلغاء
            </button>
          </>
        )
      }
    >
      {error != null && <ErrorBox error={error} />}

      {created ? (
        <>
          <div className="alert ok">
            <span>✓</span>
            <div>
              صدر التقرير <b className="mono">{created.reportNo}</b> بنسبة التزام{' '}
              <b className="num">{created.payload.sla.complianceRate}%</b>.
            </div>
          </div>
          <table>
            <tbody>
              <tr>
                <td>الزيارات الموثّقة</td>
                <td className="num">{created.payload.sla.verified}</td>
              </tr>
              <tr>
                <td>تحتاج مراجعة</td>
                <td className="num">{created.payload.sla.suspicious}</td>
              </tr>
              <tr>
                <td>غير المنفَّذ</td>
                <td className="num">{created.payload.sla.missed}</td>
              </tr>
              <tr>
                <td>رابط التحقق العام</td>
                <td>
                  <a
                    className="mono"
                    href={`${API_URL}/v1/verify/${created.verifyToken}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                  >
                    فتح صفحة التحقق
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="hint" style={{ marginTop: 10 }}>
            رمز التحقق مطبوع داخل ملف PDF. من يمسحه يرى رقم التقرير والفترة ونسبة التنفيذ فقط،
            دون أي بيانات تشغيلية.
          </div>
        </>
      ) : (
        <>
          <Field label="نوع التقرير" required>
            <select value={kind} onChange={(e) => applyKind(e.target.value as typeof kind)}>
              <option value="DAILY">يومي</option>
              <option value="WEEKLY">أسبوعي</option>
              <option value="MONTHLY">شهري</option>
              <option value="CUSTOM">فترة مخصصة</option>
            </select>
          </Field>
          <div className="row2">
            <Field label="من" required>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="إلى" required>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field
            label="عقد SLA"
            hint="بدون عقد يُحسب المطلوب زيارة واحدة يوميًا لكل نقطة فعّالة"
          >
            <select value={slaContractId} onChange={(e) => setSla(e.target.value)}>
              <option value="">— بلا عقد —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.requiredVisitsPerDay} زيارة/يوم)
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
    </Modal>
  );
}

function CreateContract({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const sectors = useData<{ items: string[] }>(() => api('/v1/bins/sectors'));
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    requiredVisitsPerDay: 1,
    scopeSector: '',
    expectedPoints: '',
    activeFrom: today(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/v1/sla-contracts', {
        method: 'POST',
        body: {
          name: form.name,
          clientName: form.clientName || null,
          requiredVisitsPerDay: form.requiredVisitsPerDay,
          scopeSector: form.scopeSector || null,
          expectedPoints: form.expectedPoints ? Number(form.expectedPoints) : null,
          activeFrom: form.activeFrom,
        },
      });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="عقد SLA جديد"
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={busy || !form.name}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </>
      }
    >
      {error != null && <ErrorBox error={error} />}
      <Field label="اسم العقد" required>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="عقد نظافة القطاع الشمالي"
        />
      </Field>
      <Field label="الجهة المتعاقدة">
        <input
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          placeholder="أمانة منطقة الرياض"
        />
      </Field>
      <div className="row2">
        <Field label="الزيارات المطلوبة يوميًا لكل نقطة" required>
          <input
            type="number"
            min={1}
            max={24}
            value={form.requiredVisitsPerDay}
            onChange={(e) =>
              setForm({ ...form, requiredVisitsPerDay: Number(e.target.value) || 1 })
            }
          />
        </Field>
        <Field label="بداية سريان العقد" required>
          <input
            type="date"
            value={form.activeFrom}
            onChange={(e) => setForm({ ...form, activeFrom: e.target.value })}
          />
        </Field>
      </div>
      <div className="row2">
        <Field label="القطاع" hint="اتركه فارغًا ليشمل كل القطاعات">
          <select
            value={form.scopeSector}
            onChange={(e) => setForm({ ...form, scopeSector: e.target.value })}
          >
            <option value="">كل القطاعات</option>
            {sectors.data?.items.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="عدد النقاط التعاقدية"
          hint="اتركه فارغًا ليُحسب من عدد الحاويات الفعّالة"
        >
          <input
            type="number"
            value={form.expectedPoints}
            onChange={(e) => setForm({ ...form, expectedPoints: e.target.value })}
            placeholder="2500"
          />
        </Field>
      </div>
    </Modal>
  );
}
