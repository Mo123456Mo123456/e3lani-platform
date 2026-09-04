'use client';

import { useState } from 'react';
import { api, download } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { ErrorBox, Field, Loading, Stat, useData } from '@/components/ui';

interface QrSummary {
  totalBins: number;
  generated: number;
  printed: number;
  notPrinted: number;
  missing: number;
}

export default function QrCenterPage() {
  const summary = useData<QrSummary>(() => api('/v1/qr/summary'));
  const sectors = useData<{ items: string[] }>(() => api('/v1/bins/sectors'));

  const [scope, setScope] = useState<'ALL' | 'SECTOR' | 'NOT_PRINTED'>('ALL');
  const [sector, setSector] = useState('');
  const [markPrinted, setMarkPrinted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const body: Record<string, unknown> = { markPrinted };
      if (scope === 'ALL') body.all = true;
      if (scope === 'NOT_PRINTED') {
        body.all = true;
        body.onlyNotPrinted = true;
      }
      if (scope === 'SECTOR') {
        if (!sector) throw new Error('اختر القطاع أولًا');
        body.sector = sector;
      }
      await download('/v1/qr/stickers', 'vero-qr-stickers.pdf', { method: 'POST', body });
      setDone('تم إنشاء ملف الملصقات وتنزيله. افتحه واطبعه على ورق لاصق A4.');
      summary.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="مركز QR">
      {summary.error != null ? (
        <ErrorBox error={summary.error} onRetry={summary.reload} />
      ) : summary.loading ? (
        <Loading rows={2} />
      ) : (
        summary.data && (
          <div className="stats">
            <Stat label="إجمالي الحاويات" value={summary.data.totalBins} tone="primary" />
            <Stat label="رموز QR جاهزة" value={summary.data.generated} tone="ok" />
            <Stat label="مطبوعة" value={summary.data.printed} />
            <Stat
              label="غير مطبوعة"
              value={summary.data.notPrinted}
              tone={summary.data.notPrinted > 0 ? 'warn' : 'ok'}
            />
            <Stat
              label="بلا رمز فعّال"
              value={summary.data.missing}
              tone={summary.data.missing > 0 ? 'bad' : 'ok'}
            />
          </div>
        )
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18 }}>
        <section className="card">
          <div className="card-head">
            <h2>إنشاء ملصقات للطباعة</h2>
          </div>
          <div className="card-body">
            {error != null && <ErrorBox error={error} />}
            {done && (
              <div className="alert ok">
                <span>✓</span>
                <div>{done}</div>
              </div>
            )}

            <Field label="نطاق الطباعة" required>
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="ALL">كل الحاويات</option>
                <option value="NOT_PRINTED">غير المطبوعة فقط</option>
                <option value="SECTOR">قطاع محدد</option>
              </select>
            </Field>

            {scope === 'SECTOR' && (
              <Field label="القطاع" required>
                <select value={sector} onChange={(e) => setSector(e.target.value)}>
                  <option value="">— اختر —</option>
                  {sectors.data?.items.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={markPrinted}
                onChange={(e) => setMarkPrinted(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span style={{ fontSize: 13 }}>تعليم الحاويات كـ«مطبوعة» بعد الإنشاء</span>
            </label>

            <button className="btn primary" onClick={generate} disabled={busy}>
              {busy ? 'جارٍ الإنشاء…' : 'إنشاء ملصقات PDF'}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>كيف تعمل الملصقات؟</h2>
          </div>
          <div className="card-body" style={{ fontSize: 13.5, lineHeight: 2 }}>
            <p style={{ marginTop: 0 }}>
              كل حاوية لها رمز QR <b>فريد وثابت</b> موقّع بمفتاح خاص بنسختك. الرمز ليس رقم
              الحاوية، فلا يمكن تصنيع ملصق صالح من خارج النظام.
            </p>
            <ul style={{ paddingInlineStart: 18, margin: 0 }}>
              <li>الملف A4 بتنسيق 3 أعمدة × 5 صفوف مع حدود قص.</li>
              <li>كل ملصق يحمل شعار الشركة واسمها ورقم الحاوية وعبارة «امسح الرمز لإثبات الخدمة».</li>
              <li>
                عند تلف ملصق: أعد طباعته من هنا — <b>يبقى نفس رقم الحاوية ونفس الرمز</b>، ولا
                تُنشأ حاوية جديدة.
              </li>
              <li>
                إعادة توليد الرمز (من صفحة الحاوية) تُستخدم فقط عند الاشتباه في تسريب الرمز،
                وتُبطل الملصق القديم فورًا.
              </li>
            </ul>
            <div className="alert warn" style={{ marginTop: 14, marginBottom: 0 }}>
              <span>🖨</span>
              <div>
                اطبع بمقياس 100% (بلا «ملاءمة الصفحة») حتى تبقى أبعاد QR صحيحة وسهلة المسح.
                يُنصح بورق لاصق مقاوم للماء للاستخدام الخارجي.
              </div>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
