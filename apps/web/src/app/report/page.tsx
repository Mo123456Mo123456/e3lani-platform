'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Select, Textarea } from '@e3lani/ui';
import { apiFetch } from '@/lib/api';
import { authedFetch, session } from '@/lib/session';

function ReportForm() {
  const params = useSearchParams();
  const adId = params.get('adId') ?? undefined;
  const postId = params.get('postId') ?? undefined;

  const [reasons, setReasons] = React.useState<{ key: string; ar: string }[]>([]);
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'sent' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    void apiFetch<{ key: string; ar: string }[]>('/reports/reasons').then(setReasons).catch(() => undefined);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session.accessToken()) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    try {
      await authedFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ adId, postId, reason, note: note || undefined }),
      });
      setStatus('sent');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message ?? 'تعذّر إرسال البلاغ');
    }
  };

  if (status === 'sent') {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-lg font-extrabold">تم استلام بلاغك</h1>
        <p className="mt-2 text-sm text-ink-muted">
          سيراجع فريق الإدارة المحتوى ويتخذ الإجراء المناسب.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <h1 className="text-lg font-extrabold">إبلاغ عن محتوى</h1>
      <form onSubmit={submit} className="space-y-4">
        <Select label="سبب البلاغ" value={reason} onChange={(event) => setReason(event.target.value)} required>
          <option value="">اختر السبب</option>
          {reasons.map((item) => (
            <option key={item.key} value={item.key}>
              {item.ar}
            </option>
          ))}
        </Select>
        <Textarea
          label="تفاصيل إضافية (اختياري)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
        />
        {status === 'error' ? <p className="text-sm text-danger">{message}</p> : null}
        <Button type="submit" fullWidth>
          إرسال البلاغ
        </Button>
      </form>
    </Card>
  );
}

export default function ReportPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] p-5">
      <Suspense fallback={null}>
        <ReportForm />
      </Suspense>
    </main>
  );
}
