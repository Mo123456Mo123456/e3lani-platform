'use client';

import * as React from 'react';
import { Badge, Button, Input, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface TickerRow {
  id: string;
  businessName: string;
  status: string;
  logoUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  requestedDays: number;
  reviewNote: string | null;
  owner: { id: string; name: string | null; phone: string };
}

export default function AdminTickerPage() {
  const canReview = useCan('ticker.review');
  const [rows, setRows] = React.useState<TickerRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('PENDING_REVIEW');
  const [days, setDays] = React.useState('30');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch<TickerRow[]>(`/admin/ticker${status ? `?status=${status}` : ''}`));
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, decision: 'APPROVE' | 'REJECT' | 'STOP') => {
    const reason =
      decision === 'APPROVE' ? undefined : window.prompt('السبب (يُرسل لصاحب الطلب)') ?? undefined;
    if (decision !== 'APPROVE' && !reason) return;
    await adminFetch(`/admin/ticker/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, days: decision === 'APPROVE' ? Number(days) : undefined }),
    });
    void load();
  };

  const columns: Column<TickerRow>[] = [
    {
      key: 'logo',
      header: 'الشعار',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-16 place-items-center overflow-hidden rounded bg-surface">
            {row.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.logoUrl} alt="" className="max-h-10 max-w-16 object-contain" />
            ) : null}
          </div>
          <span className="font-semibold">{row.businessName}</span>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'المعلن',
      render: (row) => (
        <div>
          <p>{row.owner?.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.owner?.phone}</p>
        </div>
      ),
    },
    { key: 'status', header: 'الحالة', render: (row) => <Badge tone="neutral">{row.status}</Badge> },
    {
      key: 'period',
      header: 'المدة',
      render: (row) =>
        row.startsAt ? (
          <span className="text-xs">
            {new Date(row.startsAt).toLocaleDateString('ar-SA')} →{' '}
            {row.endsAt ? new Date(row.endsAt).toLocaleDateString('ar-SA') : '—'}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">{row.requestedDays} يومًا مطلوبة</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canReview ? (
          <div className="flex flex-wrap gap-1">
            {['PENDING_REVIEW', 'REJECTED', 'EXPIRED'].includes(row.status) ? (
              <Button size="sm" onClick={() => void review(row.id, 'APPROVE')}>
                اعتماد
              </Button>
            ) : null}
            {row.status === 'PENDING_REVIEW' ? (
              <Button size="sm" variant="danger" onClick={() => void review(row.id, 'REJECT')}>
                رفض
              </Button>
            ) : null}
            {row.status === 'ACTIVE' ? (
              <Button size="sm" variant="outline" onClick={() => void review(row.id, 'STOP')}>
                إيقاف
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <AdminShell title="الشريط العلوي">
      <p className="mb-3 text-sm text-ink-muted">
        الشريط يعرض شعارات فقط، غير قابل للنقر ولا يتوقف عند اللمس. شعارات الشريط تُراجع بشريًا قبل
        الظهور.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[220px]">
          <option value="PENDING_REVIEW">بانتظار المراجعة</option>
          <option value="PENDING_PAYMENT">بانتظار الدفع</option>
          <option value="ACTIVE">نشط</option>
          <option value="REJECTED">مرفوض</option>
          <option value="EXPIRED">منتهي</option>
          <option value="">الكل</option>
        </Select>
        <Input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          className="max-w-[140px]"
          aria-label="مدة الاعتماد بالأيام"
        />
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد طلبات" />
    </AdminShell>
  );
}
