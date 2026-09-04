'use client';

import { useEffect, useState } from 'react';
import { API_URL, api, type Company } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { ErrorBox, Field, Loading, useData } from '@/components/ui';

const RADIUS_OPTIONS = [20, 30, 50];

export default function CompanyPage() {
  const data = useData<Company>(() => api('/v1/company'));
  const [form, setForm] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);

  useEffect(() => { if (data.data) setForm(data.data); }, [data.data]);

  const save = async () => {
    if (!form) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      await api('/v1/company', {
        method: 'PATCH',
        body: {
          name: form.name,
          city: form.city,
          phone: form.phone,
          email: form.email,
          address: form.address,
          defaultGpsRadiusM: form.defaultGpsRadiusM,
        },
      });
      setSaved(true);
      data.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const uploadLogo = async (file: File) => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api('/v1/company/logo', { method: 'POST', body: fd });
      setLogoVersion((v) => v + 1);
      setSaved(true);
      data.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Shell title="هوية الشركة">
      {data.error != null ? (
        <ErrorBox error={data.error} onRetry={data.reload} />
      ) : data.loading || !form ? (
        <Loading rows={6} />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <section className="card">
            <div className="card-head"><h2>البيانات الأساسية</h2></div>
            <div className="card-body">
              {error != null && <ErrorBox error={error} />}
              {saved && <div className="alert ok"><span>✓</span><div>تم الحفظ. ستظهر التغييرات في اللوحة والملصقات والتقارير.</div></div>}

              <Field label="اسم الشركة" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="row2">
                <Field label="المدينة">
                  <input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="رقم التواصل">
                  <input dir="ltr" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
              <Field label="البريد الإلكتروني">
                <input type="email" dir="ltr" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="العنوان">
                <input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>

              <Field label="نطاق GPS الافتراضي" hint="يُطبَّق على الحاويات الجديدة فقط. الحاويات الحالية تحتفظ بنطاقها.">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RADIUS_OPTIONS.map((r) => (
                    <button key={r} type="button"
                      className={`btn sm ${form.defaultGpsRadiusM === r ? 'primary' : ''}`}
                      onClick={() => setForm({ ...form, defaultGpsRadiusM: r })}>
                      {r} متر
                    </button>
                  ))}
                  <input type="number" min={5} max={5000} style={{ width: 110 }}
                    value={form.defaultGpsRadiusM}
                    onChange={(e) => setForm({ ...form, defaultGpsRadiusM: Number(e.target.value) || 30 })} />
                </div>
              </Field>

              <Field label="المنطقة الزمنية" hint="لتغييرها راجع الدعم الفني — تغييرها يؤثر على حساب أيام الخدمة السابقة.">
                <input className="mono" value={form.timezone} disabled />
              </Field>

              <button className="btn primary" onClick={save} disabled={busy}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>الشعار</h2></div>
            <div className="card-body">
              <div style={{
                border: '1px dashed var(--line-strong)', borderRadius: 12, padding: 22,
                textAlign: 'center', marginBottom: 14, background: 'var(--surface-alt)',
              }}>
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${API_URL}${form.logoUrl}?v=${logoVersion}`} alt="شعار الشركة"
                    style={{ maxWidth: 160, maxHeight: 110, objectFit: 'contain' }} />
                ) : (
                  <div className="hint">لا يوجد شعار محفوظ</div>
                )}
              </div>

              <Field label="رفع شعار جديد" hint="PNG أو JPG، بحد أقصى 3 ميجابايت. يُفضّل خلفية شفافة ومربع تقريبًا.">
                <input type="file" accept="image/png,image/jpeg" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
              </Field>

              <div className="alert info">
                <span>ℹ</span>
                <div>الشعار يظهر تلقائيًا في: لوحة الإدارة، ملصقات QR، تقارير PDF، وأوراق تفعيل الأجهزة.</div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
