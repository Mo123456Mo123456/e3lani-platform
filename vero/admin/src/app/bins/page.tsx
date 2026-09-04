'use client';

import { useState } from 'react';
import { api, type Bin, type Paged } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  StatusPill,
  fmtDateTime,
  useData,
} from '@/components/ui';

const EMPTY_FORM = {
  publicId: '',
  name: '',
  sector: '',
  area: '',
  address: '',
  lat: '',
  lon: '',
  gpsRadiusM: '',
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
};

export default function BinsPage() {
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [serviced, setServiced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Bin | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (q) params.set('q', q);
  if (sector) params.set('sector', sector);
  if (serviced) params.set('serviced', serviced);

  const list = useData<Paged<Bin>>(() => api(`/v1/bins?${params}`), [
    q,
    sector,
    serviced,
    page,
  ]);
  const sectors = useData<{ items: string[] }>(() => api('/v1/bins/sectors'));

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <Shell title="الحاويات ونقاط الخدمة">
      <div className="toolbar">
        <input
          type="search"
          placeholder="بحث برقم الحاوية أو الاسم أو العنوان…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: 260 }}
        />
        <select
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل القطاعات</option>
          {sectors.data?.items.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={serviced}
          onChange={(e) => {
            setServiced(e.target.value);
            setPage(1);
          }}
        >
          <option value="">الكل</option>
          <option value="YES">تمت خدمتها اليوم</option>
          <option value="NO">لم تتم خدمتها اليوم</option>
        </select>
        <div className="spacer" />
        <button className="btn" onClick={() => setImporting(true)}>
          استيراد CSV
        </button>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + حاوية جديدة
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
          <Empty
            icon="🗑"
            title="لا توجد حاويات مطابقة"
            hint="أضف حاوية يدويًا أو استورد ملف CSV يحتوي الإحداثيات"
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>رقم الحاوية</th>
                    <th>الوصف</th>
                    <th>القطاع</th>
                    <th>المنطقة</th>
                    <th>النطاق</th>
                    <th>اليوم</th>
                    <th>الحالة</th>
                    <th>QR</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((b) => (
                    <tr key={b.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        {b.publicId}
                      </td>
                      <td>{b.name ?? '—'}</td>
                      <td>{b.sector ?? '—'}</td>
                      <td>{b.area ?? '—'}</td>
                      <td className="num">{b.gpsRadiusM} م</td>
                      <td>
                        {b.servicedOnDay ? (
                          <span className="pill ok">تمت</span>
                        ) : (
                          <span className="pill muted">لم تتم</span>
                        )}
                      </td>
                      <td>
                        <StatusPill status={b.status} />
                      </td>
                      <td className="hint">{b.qrPrintedAt ? 'مطبوع' : 'غير مطبوع'}</td>
                      <td style={{ textAlign: 'left' }}>
                        <button className="btn sm" onClick={() => setEditing(b)}>
                          تفاصيل
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
                إجمالي <span className="num">{list.data.total}</span> — صفحة{' '}
                <span className="num">{list.data.page}</span> من{' '}
                <span className="num">{pages}</span>
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

      {(creating || editing) && (
        <BinForm
          bin={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            list.reload();
            sectors.reload();
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            list.reload();
            sectors.reload();
          }}
        />
      )}
    </Shell>
  );
}

function BinForm({
  bin,
  onClose,
  onSaved,
}: {
  bin: Bin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(
    bin
      ? {
          publicId: bin.publicId,
          name: bin.name ?? '',
          sector: bin.sector ?? '',
          area: bin.area ?? '',
          address: bin.address ?? '',
          lat: String(bin.lat),
          lon: String(bin.lon),
          gpsRadiusM: String(bin.gpsRadiusM),
          status: bin.status as 'ACTIVE' | 'DISABLED',
        }
      : EMPTY_FORM,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const detail = useData<Bin & { qrToken: string | null }>(
    () => (bin ? api(`/v1/bins/${bin.id}`) : Promise.resolve(null as never)),
    [bin?.id],
  );
  if (detail.data?.qrToken && qrToken === null) setQrToken(detail.data.qrToken);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        publicId: form.publicId || undefined,
        name: form.name || null,
        sector: form.sector || null,
        area: form.area || null,
        address: form.address || null,
        lat: Number(form.lat),
        lon: Number(form.lon),
        gpsRadiusM: form.gpsRadiusM ? Number(form.gpsRadiusM) : null,
        status: form.status,
      };
      if (bin) await api(`/v1/bins/${bin.id}`, { method: 'PATCH', body });
      else await api('/v1/bins', { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!bin) return;
    if (!confirm(`حذف الحاوية ${bin.publicId} نهائيًا مع كل زياراتها؟`)) return;
    setBusy(true);
    try {
      await api(`/v1/bins/${bin.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={bin ? `الحاوية ${bin.publicId}` : 'حاوية جديدة'}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <div style={{ flex: 1 }} />
          {bin && (
            <button className="btn danger" onClick={remove} disabled={busy}>
              حذف
            </button>
          )}
        </>
      }
    >
      {error != null && <ErrorBox error={error} />}

      <Field
        label="رقم الحاوية"
        hint={bin ? 'تغييره يعني تغيير ما هو مطبوع على الملصق' : 'اتركه فارغًا ليولّده النظام تلقائيًا (VR-000001)'}
      >
        <input
          className="mono"
          value={form.publicId}
          onChange={(e) => setForm({ ...form, publicId: e.target.value })}
          placeholder="VR-000001"
        />
      </Field>

      <Field label="الاسم أو الوصف">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>

      <div className="row2">
        <Field label="القطاع">
          <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
        </Field>
        <Field label="المنطقة">
          <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        </Field>
      </div>

      <Field label="العنوان">
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>

      <div className="row2">
        <Field label="خط العرض (Latitude)" required>
          <input
            className="mono"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            placeholder="24.7136"
          />
        </Field>
        <Field label="خط الطول (Longitude)" required>
          <input
            className="mono"
            value={form.lon}
            onChange={(e) => setForm({ ...form, lon: e.target.value })}
            placeholder="46.6753"
          />
        </Field>
      </div>

      <div className="row2">
        <Field label="نطاق GPS (متر)" hint="اتركه فارغًا لاستخدام نطاق الشركة الافتراضي">
          <input
            type="number"
            value={form.gpsRadiusM}
            onChange={(e) => setForm({ ...form, gpsRadiusM: e.target.value })}
          />
        </Field>
        <Field label="الحالة">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'DISABLED' })}
          >
            <option value="ACTIVE">فعّالة</option>
            <option value="DISABLED">معطّلة</option>
          </select>
        </Field>
      </div>

      {bin && (
        <div className="alert info" style={{ marginTop: 6 }}>
          <span>🔳</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>رمز QR الثابت لهذه الحاوية</div>
            <div className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
              {qrToken ?? '—'}
            </div>
            <div className="hint" style={{ marginTop: 4 }}>
              إعادة الطباعة تُبقي هذا الرمز كما هو. لا تنشئ حاوية جديدة عند تلف الملصق.
            </div>
            <div style={{ marginTop: 8 }}>
              <a
                className="btn sm"
                href={`${process.env.NEXT_PUBLIC_API_URL}/v1/qr/bin/${bin.id}.png?size=600`}
                target="_blank"
                rel="noreferrer"
              >
                معاينة صورة QR
              </a>
            </div>
          </div>
        </div>
      )}

      {bin && (
        <div className="hint">
          أُنشئت: {fmtDateTime(bin.createdAt)} · آخر زيارة: {fmtDateTime(bin.lastScanAt)}
        </div>
      )}
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    failed: { row: number; publicId?: string; reason: string }[];
  } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<typeof result>('/v1/bins/import', { method: 'POST', body: { csv } });
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="استيراد الحاويات من CSV"
      onClose={onClose}
      footer={
        result ? (
          <button className="btn primary" onClick={onDone}>
            تم
          </button>
        ) : (
          <>
            <button className="btn primary" onClick={run} disabled={busy || csv.trim().length === 0}>
              {busy ? 'جارٍ الاستيراد…' : 'استيراد'}
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>
              إلغاء
            </button>
          </>
        )
      }
    >
      {error != null && <ErrorBox error={error} />}

      {result ? (
        <>
          <div className="alert ok">
            <span>✓</span>
            <div>
              أُنشئت <b className="num">{result.created}</b> حاوية، وحُدّثت{' '}
              <b className="num">{result.updated}</b>.
            </div>
          </div>
          {result.failed.length > 0 && (
            <>
              <div className="alert warn">
                <span>⚠</span>
                <div>
                  تعذّر استيراد <b className="num">{result.failed.length}</b> صف:
                </div>
              </div>
              <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>الصف</th>
                      <th>رقم الحاوية</th>
                      <th>السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f) => (
                      <tr key={f.row}>
                        <td className="num">{f.row}</td>
                        <td className="mono">{f.publicId ?? '—'}</td>
                        <td>{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="alert info">
            <span>ℹ</span>
            <div>
              الأعمدة المطلوبة: <code>lat</code> و <code>lon</code> (أو «خط العرض» و«خط الطول»).
              الأعمدة الاختيارية: <code>public_id</code>, <code>name</code>, <code>sector</code>,{' '}
              <code>area</code>, <code>address</code>, <code>radius</code>.
              <br />
              الصف الذي يحمل <code>public_id</code> موجودًا يُحدَّث بدل إنشاء حاوية مكرّرة.
            </div>
          </div>
          <Field label="ألصق محتوى ملف CSV" required>
            <textarea
              rows={10}
              className="mono"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={'public_id,name,sector,area,lat,lon\nVR-000001,حاوية المسجد,القطاع الأول,الملز,24.7136,46.6753'}
            />
          </Field>
        </>
      )}
    </Modal>
  );
}
