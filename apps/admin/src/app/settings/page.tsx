'use client';

import * as React from 'react';
import { SETTING_KEYS } from '@e3lani/config';
import { Button, Card, Input, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

const LABELS: Record<string, string> = {
  PUBLISHING_MODE: 'وضع النشر',
  PAYMENTS_ENABLED: 'تفعيل الدفع',
  AUTO_MODERATION_ENABLED: 'الفحص الآلي عند الرفع',
  TICKER_ENABLED: 'تفعيل الشريط العلوي',
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

      {!canWrite ? (
        <p className="mt-4 text-sm text-ink-muted">لا تملك صلاحية تعديل الإعدادات.</p>
      ) : null}
    </AdminShell>
  );
}
