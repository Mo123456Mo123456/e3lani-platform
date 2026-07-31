'use client';

import * as React from 'react';
import { Badge, Button, Select, Textarea } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AdminReport {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  ad: { id: string; title: string; status: string } | null;
  post: { id: string; caption: string; isActive: boolean } | null;
  reporter: { id: string; name: string | null; phone: string } | null;
}

const ACTIONS = [
  { value: 'DISMISS', label: 'تجاهل البلاغ' },
  { value: 'SUSPEND', label: 'إيقاف المحتوى' },
  { value: 'DELETE', label: 'حذف المحتوى' },
  { value: 'RESTORE', label: 'إعادة التفعيل' },
] as const;

export default function AdminReportsPage() {
  const canResolve = useCan('reports.resolve');
  const [rows, setRows] = React.useState<AdminReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('OPEN');
  const [selected, setSelected] = React.useState<AdminReport | null>(null);
  const [action, setAction] = React.useState<(typeof ACTIONS)[number]['value']>('DISMISS');
  const [reason, setReason] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const page = await adminFetch<{ items: AdminReport[] }>(
        `/admin/reports?limit=25${status ? `&status=${status}` : ''}`,
      );
      setRows(page.items);
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const resolve = async () => {
    if (!selected || reason.trim().length < 3) return;
    await adminFetch(`/admin/reports/${selected.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, reason, notifyOwner: true }),
    });
    setSelected(null);
    setReason('');
    void load();
  };

  const columns: Column<AdminReport>[] = [
    {
      key: 'target',
      header: 'المحتوى',
      render: (row) => (
        <div>
          <p className="line-clamp-1 font-semibold">
            {row.ad?.title ?? row.post?.caption ?? '—'}
          </p>
          <p className="text-xs text-ink-muted">{row.ad ? 'إعلان' : 'منشور'}</p>
        </div>
      ),
    },
    { key: 'reason', header: 'السبب', render: (row) => <span className="text-sm">{row.reason}</span> },
    {
      key: 'note',
      header: 'ملاحظة المبلّغ',
      render: (row) => <span className="line-clamp-2 text-xs text-ink-muted">{row.note ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'OPEN' ? 'warning' : row.status === 'ACTIONED' ? 'success' : 'neutral'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canResolve && ['OPEN', 'UNDER_REVIEW'].includes(row.status) ? (
          <Button size="sm" onClick={() => setSelected(row)}>
            معالجة
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminShell title="البلاغات">
      <div className="mb-3 flex gap-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[200px]">
          <option value="OPEN">مفتوحة</option>
          <option value="UNDER_REVIEW">قيد المراجعة</option>
          <option value="ACTIONED">تم اتخاذ إجراء</option>
          <option value="DISMISSED">مُتجاهلة</option>
          <option value="">الكل</option>
        </Select>
      </div>

      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد بلاغات" />

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5">
            <h2 className="text-lg font-extrabold">معالجة البلاغ</h2>
            <p className="text-sm text-ink-muted">
              {selected.ad?.title ?? selected.post?.caption ?? ''}
            </p>
            <Select
              label="الإجراء"
              value={action}
              onChange={(event) => setAction(event.target.value as typeof action)}
            >
              {ACTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Textarea
              label="السبب (يُسجّل ويُرسل لصاحب المحتوى)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => void resolve()} fullWidth>
                تنفيذ
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)} fullWidth>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
