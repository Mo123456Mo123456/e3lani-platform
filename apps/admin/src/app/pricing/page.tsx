'use client';

import * as React from 'react';
import { halalasToSar, sarToHalalas } from '@e3lani/config';
import { Badge, Button, Card, Input, Textarea } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

interface Version {
  id: string;
  amountSar: number;
  amountHalalas: number;
  durationDays: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
  note: string | null;
}

interface PricingRow {
  key: string;
  nameAr: string;
  descriptionAr: string | null;
  isActive: boolean;
  current: Version | null;
  scheduled: Version[];
  history: Version[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });

const STATUS_TONE = {
  ACTIVE: 'success',
  SCHEDULED: 'warning',
  EXPIRED: 'neutral',
} as const;

const STATUS_LABEL = { ACTIVE: 'نافذ الآن', SCHEDULED: 'مجدول', EXPIRED: 'منتهٍ' } as const;

/**
 * الأسعار مؤرَّخة بإصدارات: لا يُعدَّل سعر قائم أبدًا، بل يُضاف إصدار جديد.
 * هذا يحفظ الخط الزمني الكامل ويتيح الجدولة المسبقة والتراجع.
 */
export default function AdminPricingPage() {
  const canWrite = useCan('pricing.write');
  const [rows, setRows] = React.useState<PricingRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<PricingRow | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ sar: '', days: '', effectiveFrom: '', note: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch<PricingRow[]>('/admin/pricing'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (row: PricingRow) => {
    setEditing(row);
    setError(null);
    setForm({
      sar: String(row.current?.amountSar ?? ''),
      days: row.current?.durationDays === null ? '' : String(row.current?.durationDays ?? ''),
      effectiveFrom: '',
      note: '',
    });
  };

  const submit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/admin/pricing/versions', {
        method: 'POST',
        body: JSON.stringify({
          key: editing.key,
          amountHalalas: sarToHalalas(Number(form.sar || 0)),
          durationDays: form.days === '' ? null : Number(form.days),
          effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : undefined,
          note: form.note || undefined,
        }),
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (row: PricingRow) => {
    if (!window.confirm(`الرجوع إلى السعر السابق لخدمة «${row.nameAr}»؟`)) return;
    try {
      await adminFetch(`/admin/pricing/${row.key}/rollback`, { method: 'POST' });
      await load();
    } catch (err: any) {
      window.alert(err.message ?? 'تعذّر التراجع');
    }
  };

  const cancelScheduled = async (versionId: string) => {
    if (!window.confirm('إلغاء هذا الإصدار المجدول؟')) return;
    await adminFetch(`/admin/pricing/versions/${versionId}`, { method: 'DELETE' });
    await load();
  };

  const toggle = async (row: PricingRow) => {
    await adminFetch(`/admin/pricing/${row.key}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await load();
  };

  return (
    <AdminShell title="الأسعار">
      <p className="mb-4 text-sm text-ink-muted">
        كل تغيير سعر يُسجَّل كإصدار جديد بتاريخ سريان، ولا يُعدَّل أو يُحذف أي إصدار سابق —
        فيبقى الخط الزمني الكامل متاحًا للمراجعة والتقارير.
      </p>

      {loading ? (
        <p className="text-sm text-ink-muted">جارٍ التحميل…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.key} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-extrabold">{row.nameAr}</h2>
                  <p className="text-xs text-ink-muted">{row.descriptionAr}</p>
                </div>
                <Badge tone={row.isActive ? 'success' : 'neutral'}>
                  {row.isActive ? 'مفعّلة' : 'معطّلة'}
                </Badge>
              </div>

              <div className="rounded-lg bg-surface p-3">
                {row.current ? (
                  <>
                    <p className="text-2xl font-extrabold">
                      {row.current.amountSar} <span className="text-sm font-semibold">ريال</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {row.current.durationDays ? `لمدة ${row.current.durationDays} يومًا · ` : ''}
                      نافذ منذ {formatDate(row.current.effectiveFrom)}
                      {row.current.effectiveTo ? ` حتى ${formatDate(row.current.effectiveTo)}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-danger">لا يوجد سعر نافذ</p>
                )}
              </div>

              {row.scheduled.length ? (
                <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <p className="text-xs font-bold">تغييرات مجدولة</p>
                  {row.scheduled.map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {version.amountSar} ريال — يبدأ {formatDate(version.effectiveFrom)}
                      </span>
                      {canWrite ? (
                        <button
                          onClick={() => void cancelScheduled(version.id)}
                          className="text-xs font-bold text-danger"
                        >
                          إلغاء
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openEditor(row)}>
                    سعر جديد
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void rollback(row)}>
                    تراجع
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggle(row)}>
                    {row.isActive ? 'تعطيل' : 'تفعيل'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(expanded === row.key ? null : row.key)}
                  >
                    {expanded === row.key ? 'إخفاء التاريخ' : `التاريخ (${row.history.length})`}
                  </Button>
                </div>
              ) : null}

              {expanded === row.key ? (
                <ol className="space-y-1 border-t border-line pt-2 text-xs">
                  {row.history.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{version.amountSar} ريال</span>
                      <span className="text-ink-muted">
                        {formatDate(version.effectiveFrom)} →{' '}
                        {version.effectiveTo ? formatDate(version.effectiveTo) : 'مفتوح'}
                      </span>
                      <Badge tone={STATUS_TONE[version.status]}>{STATUS_LABEL[version.status]}</Badge>
                    </li>
                  ))}
                </ol>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-5">
            <h2 className="text-lg font-extrabold">سعر جديد — {editing.nameAr}</h2>
            <p className="text-xs text-ink-muted">
              السعر الحالي {editing.current?.amountSar ?? '—'} ريال. اترك تاريخ البدء فارغًا
              للتطبيق الفوري، أو حدّد تاريخًا مستقبليًا لجدولته.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="السعر (ريال)"
                type="number"
                min={0}
                value={form.sar}
                onChange={(event) => setForm({ ...form, sar: event.target.value })}
              />
              <Input
                label="المدة (أيام)"
                type="number"
                min={0}
                value={form.days}
                onChange={(event) => setForm({ ...form, days: event.target.value })}
              />
            </div>

            <Input
              label="يبدأ من (اختياري)"
              type="datetime-local"
              value={form.effectiveFrom}
              onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
            />

            <Textarea
              label="سبب التغيير"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <div className="flex gap-2">
              <Button fullWidth loading={busy} onClick={() => void submit()}>
                حفظ الإصدار
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
}
