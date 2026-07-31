'use client';

import * as React from 'react';
import { Badge, Button, Select, Textarea, timeAgo } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface Appeal {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; phone: string };
  ad: { id: string; title: string; status: string } | null;
  post: { id: string; caption: string } | null;
}

export default function AdminAppealsPage() {
  const canResolve = useCan('appeals.resolve');
  const [rows, setRows] = React.useState<Appeal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('OPEN');
  const [selected, setSelected] = React.useState<Appeal | null>(null);
  const [decision, setDecision] = React.useState<'ACCEPT' | 'REJECT'>('ACCEPT');
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch<Appeal[]>(`/admin/appeals${status ? `?status=${status}` : ''}`));
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const decide = async () => {
    if (!selected || note.trim().length < 3) return;
    await adminFetch(`/admin/appeals/${selected.id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
    setSelected(null);
    setNote('');
    void load();
  };

  const columns: Column<Appeal>[] = [
    {
      key: 'target',
      header: 'المحتوى',
      render: (row) => <span className="line-clamp-1">{row.ad?.title ?? row.post?.caption ?? '—'}</span>,
    },
    {
      key: 'user',
      header: 'مقدّم الاعتراض',
      render: (row) => (
        <div>
          <p>{row.user.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.user.phone}</p>
        </div>
      ),
    },
    {
      key: 'message',
      header: 'النص',
      render: (row) => <span className="line-clamp-2 text-xs">{row.message}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'OPEN' ? 'warning' : row.status === 'ACCEPTED' ? 'success' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'time', header: 'التاريخ', render: (row) => <span className="text-xs">{timeAgo(row.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canResolve && row.status === 'OPEN' ? (
          <Button size="sm" onClick={() => setSelected(row)}>
            بت في الاعتراض
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminShell title="الاعتراضات">
      <div className="mb-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[200px]">
          <option value="OPEN">مفتوحة</option>
          <option value="ACCEPTED">مقبولة</option>
          <option value="REJECTED">مرفوضة</option>
          <option value="">الكل</option>
        </Select>
      </div>

      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد اعتراضات" />

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-5">
            <h2 className="text-lg font-extrabold">قرار الاعتراض</h2>
            <p className="rounded-md bg-surface p-3 text-sm">{selected.message}</p>
            <Select
              label="القرار"
              value={decision}
              onChange={(event) => setDecision(event.target.value as 'ACCEPT' | 'REJECT')}
            >
              <option value="ACCEPT">قبول — إعادة تفعيل المحتوى</option>
              <option value="REJECT">رفض — إبقاء القرار</option>
            </Select>
            <Textarea label="ملاحظة تُرسل لصاحب المحتوى" value={note} onChange={(event) => setNote(event.target.value)} />
            <div className="flex gap-2">
              <Button fullWidth onClick={() => void decide()}>
                حفظ القرار
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setSelected(null)}>
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
