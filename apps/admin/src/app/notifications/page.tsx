'use client';

import * as React from 'react';
import { Button, Card, Input, Select, Textarea } from '@e3lani/ui';
import { AdminShell } from '@/components/admin-shell';
import { adminFetch } from '@/lib/admin-api';

export default function AdminNotificationsPage() {
  const [form, setForm] = React.useState({
    audience: 'ALL',
    titleAr: '',
    titleEn: '',
    bodyAr: '',
    bodyEn: '',
  });
  const [result, setResult] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await adminFetch<{ sent: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setResult(`تم الإرسال إلى ${response.sent} مستخدمًا`);
    } catch (error: any) {
      setResult(error.message ?? 'تعذّر الإرسال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="الإشعارات">
      <Card className="max-w-xl space-y-4 p-5">
        <h2 className="font-extrabold">إرسال إشعار عام</h2>
        <form onSubmit={submit} className="space-y-3">
          <Select
            label="الجمهور"
            value={form.audience}
            onChange={(event) => setForm({ ...form, audience: event.target.value })}
          >
            <option value="ALL">كل المستخدمين</option>
            <option value="BUSINESS">الحسابات التجارية</option>
            <option value="INDIVIDUAL">الأفراد</option>
          </Select>
          <Input
            label="العنوان (عربي)"
            value={form.titleAr}
            onChange={(event) => setForm({ ...form, titleAr: event.target.value })}
            required
          />
          <Input
            label="العنوان (إنجليزي)"
            value={form.titleEn}
            onChange={(event) => setForm({ ...form, titleEn: event.target.value })}
            required
          />
          <Textarea
            label="النص (عربي)"
            value={form.bodyAr}
            onChange={(event) => setForm({ ...form, bodyAr: event.target.value })}
            required
          />
          <Textarea
            label="النص (إنجليزي)"
            value={form.bodyEn}
            onChange={(event) => setForm({ ...form, bodyEn: event.target.value })}
            required
          />
          {result ? <p className="text-sm font-semibold">{result}</p> : null}
          <Button type="submit" loading={loading}>
            إرسال
          </Button>
        </form>
      </Card>
    </AdminShell>
  );
}
