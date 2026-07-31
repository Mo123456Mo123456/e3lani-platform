'use client';

import * as React from 'react';
import type { PricingItemDto } from '@e3lani/types';
import { halalasToSar, sarToHalalas } from '@e3lani/config';
import { Badge, Button, Card, Input } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

/** الأسعار تُعدَّل من هنا فقط وتنعكس فورًا على كل التطبيقات. */
export default function AdminPricingPage() {
  const canWrite = useCan('pricing.write');
  const [items, setItems] = React.useState<PricingItemDto[]>([]);
  const [draft, setDraft] = React.useState<Record<string, { sar: string; days: string }>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const rows = await adminFetch<PricingItemDto[]>('/admin/pricing');
    setItems(rows);
    setDraft(
      Object.fromEntries(
        rows.map((row) => [
          row.key,
          { sar: String(halalasToSar(row.amountHalalas)), days: String(row.durationDays ?? '') },
        ]),
      ),
    );
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (item: PricingItemDto) => {
    const entry = draft[item.key];
    if (!entry) return;
    setSaving(item.key);
    try {
      await adminFetch('/admin/pricing', {
        method: 'POST',
        body: JSON.stringify({
          key: item.key,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          descriptionAr: item.descriptionAr ?? undefined,
          amountHalalas: sarToHalalas(Number(entry.sar || 0)),
          durationDays: entry.days === '' ? null : Number(entry.days),
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  };

  const toggle = async (item: PricingItemDto) => {
    await adminFetch('/admin/pricing', {
      method: 'POST',
      body: JSON.stringify({
        key: item.key,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        descriptionAr: item.descriptionAr ?? undefined,
        amountHalalas: item.amountHalalas,
        durationDays: item.durationDays,
        isActive: !item.isActive,
        sortOrder: item.sortOrder,
      }),
    });
    await load();
  };

  return (
    <AdminShell title="الأسعار">
      <p className="mb-3 text-sm text-ink-muted">
        كل الأسعار تُقرأ من قاعدة البيانات ولا توجد قيمة ثابتة داخل الكود.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.key} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-extrabold">{item.nameAr}</h2>
                <p className="text-xs text-ink-muted">{item.descriptionAr}</p>
              </div>
              <Badge tone={item.isActive ? 'success' : 'neutral'}>
                {item.isActive ? 'مفعّل' : 'معطّل'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="السعر (ريال)"
                type="number"
                min={0}
                step="1"
                disabled={!canWrite}
                value={draft[item.key]?.sar ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [item.key]: { ...draft[item.key]!, sar: event.target.value },
                  })
                }
              />
              <Input
                label="المدة (أيام)"
                type="number"
                min={0}
                disabled={!canWrite}
                value={draft[item.key]?.days ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [item.key]: { ...draft[item.key]!, days: event.target.value },
                  })
                }
              />
            </div>

            {canWrite ? (
              <div className="flex gap-2">
                <Button size="sm" loading={saving === item.key} onClick={() => void save(item)}>
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => void toggle(item)}>
                  {item.isActive ? 'تعطيل' : 'تفعيل'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">لا تملك صلاحية التعديل</p>
            )}
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
