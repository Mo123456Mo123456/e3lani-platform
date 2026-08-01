'use client';

import * as React from 'react';
import { SETTING_KEYS } from '@e3lani/config';
import { Button, Card, Input, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

const RANKING_LABELS: Record<string, string> = {
  quality: 'وزن جودة الإعلان',
  affinity: 'وزن تقارب المستخدم مع القسم',
  geo: 'وزن القرب الجغرافي',
  freshness: 'وزن الحداثة',
  promoted: 'دفعة الإعلان المدفوع',
  seenPenalty: 'عقوبة تكرار العرض',
  freshnessHalfLifeHours: 'نصف عمر الحداثة (ساعات)',
  maxAdsPerAdvertiser: 'أقصى إعلانات لمعلن واحد',
  sessionTtlSeconds: 'مدة تثبيت ترتيب الجلسة (ثوانٍ)',
};

const LABELS: Record<string, string> = {
  PUBLISHING_MODE: 'وضع النشر',
  PAYMENTS_ENABLED: 'تفعيل الدفع',
  AUTO_MODERATION_ENABLED: 'الفحص الآلي عند الرفع',
  TICKER_ENABLED: 'تفعيل الشريط العلوي',
  PERSONALIZED_FEED_ENABLED: 'الترتيب الذكي لتبويب «لك»',
  RANKING_WEIGHTS: 'أوزان محرّك الترتيب',
  MIN_APP_VERSION: 'أقل إصدار مدعوم للتطبيق',
  SUPPORT_WHATSAPP: 'واتساب الدعم',
  TERMS_VERSION: 'إصدار الشروط',
  PRIVACY_VERSION: 'إصدار سياسة الخصوصية',
};

export default function AdminSettingsPage() {
  const canWrite = useCan('settings.write');
  const [settings, setSettings] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setSettings(await adminFetch<Record<string, unknown>>('/admin/settings'));
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      await adminFetch('/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value }) });
      await load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminShell title="الإعدادات">
      <div className="grid gap-3 md:grid-cols-2">
        {Object.keys(SETTING_KEYS).map((key) => {
          const value = settings[key];
          const isBoolean = typeof value === 'boolean';
          const isMode = key === 'PUBLISHING_MODE';

          // أوزان الترتيب كائن مركّب — لها بطاقة خاصة أسفل الصفحة
          if (key === 'RANKING_WEIGHTS') return null;

          return (
            <Card key={key} className="space-y-2 p-4">
              <h2 className="font-bold">{LABELS[key] ?? key}</h2>

              {isMode ? (
                <Select
                  value={String(value ?? 'FREE')}
                  disabled={!canWrite || saving === key}
                  onChange={(event) => void update(key, event.target.value)}
                >
                  <option value="FREE">مجاني — مسودة ثم نشط مباشرة</option>
                  <option value="PAID">مدفوع — مسودة ثم بانتظار الدفع ثم نشط</option>
                </Select>
              ) : isBoolean ? (
                <Select
                  value={value ? 'true' : 'false'}
                  disabled={!canWrite || saving === key}
                  onChange={(event) => void update(key, event.target.value === 'true')}
                >
                  <option value="true">مفعّل</option>
                  <option value="false">معطّل</option>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    defaultValue={String(value ?? '')}
                    disabled={!canWrite}
                    onBlur={(event) => {
                      if (event.target.value !== String(value ?? '')) {
                        void update(key, event.target.value);
                      }
                    }}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 space-y-3 p-4">
        <div>
          <h2 className="font-extrabold">أوزان محرّك الترتيب</h2>
          <p className="text-xs text-ink-muted">
            الترتيب يعمل داخل الخادم بلا أي مزوّد خارجي. الدرجة النهائية لكل إعلان =
            (جودة × وزنها) + (تقارب × وزنه) + (قرب × وزنه) + (حداثة × وزنها) + دفعة المدفوع −
            عقوبة التكرار. رفع أي وزن يزيد تأثير إشارته على الموجز فورًا.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(RANKING_LABELS).map(([field, label]) => (
            <Input
              key={field}
              label={label}
              type="number"
              step="0.1"
              min={0}
              disabled={!canWrite || saving === 'RANKING_WEIGHTS'}
              defaultValue={String((settings.RANKING_WEIGHTS as any)?.[field] ?? '')}
              onBlur={(event) => {
                const next = {
                  ...(settings.RANKING_WEIGHTS as Record<string, number>),
                  [field]: Number(event.target.value),
                };
                if (Number.isFinite(next[field])) void update('RANKING_WEIGHTS', next);
              }}
            />
          ))}
        </div>
      </Card>

      {!canWrite ? (
        <p className="mt-4 text-sm text-ink-muted">لا تملك صلاحية تعديل الإعدادات.</p>
      ) : null}
    </AdminShell>
  );
}
