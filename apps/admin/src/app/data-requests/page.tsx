'use client';

import * as React from 'react';
import { Badge, Button, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface DataRequest {
  id: string;
  type: 'EXPORT' | 'DELETE';
  status: string;
  note: string | null;
  user: { id: string; name: string | null; phone: string; email: string | null };
  createdAt: string;
  completedAt: string | null;
}

const TYPE_LABEL = { EXPORT: 'تصدير البيانات', DELETE: 'حذف البيانات' } as const;

/** طلبات المستخدمين بحق الوصول إلى بياناتهم أو حذفها (نظام حماية البيانات الشخصية). */
export default function AdminDataRequestsPage() {
  const canHandle = useCan('users.write');
  const [rows, setRows] = React.useState<DataRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('PENDING');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch<DataRequest[]>(`/admin/data-requests${status ? `?status=${status}` : ''}`));
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handle = async (row: DataRequest, next: 'PROCESSING' | 'COMPLETED' | 'REJECTED') => {
    const warning =
      next === 'COMPLETED' && row.type === 'DELETE'
        ? 'سيُحذف حساب المستخدم وتُخفى كل إعلاناته ومنشوراته نهائيًا. متابعة؟'
        : null;
    if (warning && !window.confirm(warning)) return;

    const note = next === 'REJECTED' ? window.prompt('سبب الرفض') : undefined;
    if (next === 'REJECTED' && !note) return;

    try {
      await adminFetch(`/admin/data-requests/${row.id}/handle`, {
        method: 'POST',
        body: JSON.stringify({ status: next, note: note ?? undefined }),
      });
      await load();
    } catch (error: any) {
      window.alert(error.message ?? 'تعذّر تنفيذ الطلب');
    }
  };

  const columns: Column<DataRequest>[] = [
    {
      key: 'type',
      header: 'نوع الطلب',
      render: (row) => (
        <Badge tone={row.type === 'DELETE' ? 'danger' : 'info'}>{TYPE_LABEL[row.type]}</Badge>
      ),
    },
    {
      key: 'user',
      header: 'المستخدم',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.user.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.user.phone}</p>
        </div>
      ),
    },
    {
      key: 'note',
      header: 'ملاحظة',
      render: (row) => <span className="line-clamp-2 text-xs">{row.note ?? '—'}</span>,
    },
    { key: 'status', header: 'الحالة', render: (row) => <Badge tone="neutral">{row.status}</Badge> },
    {
      key: 'date',
      header: 'التاريخ',
      render: (row) => (
        <span className="text-xs">{new Date(row.createdAt).toLocaleDateString('ar-SA')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canHandle && !['COMPLETED', 'REJECTED'].includes(row.status) ? (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" onClick={() => void handle(row, 'COMPLETED')}>
              تنفيذ
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handle(row, 'PROCESSING')}>
              قيد المعالجة
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handle(row, 'REJECTED')}>
              رفض
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AdminShell title="طلبات بيانات المستخدمين">
      <p className="mb-3 text-sm text-ink-muted">
        طلب التصدير ينشئ ملفًا بكل بيانات المستخدم ويرسل له رابط تنزيل مؤقتًا. طلب الحذف يُخفي
        حسابه ومحتواه نهائيًا مع الإبقاء على السجلات المالية المطلوبة نظامًا.
      </p>

      <div className="mb-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[220px]">
          <option value="PENDING">جديدة</option>
          <option value="PROCESSING">قيد المعالجة</option>
          <option value="COMPLETED">منفَّذة</option>
          <option value="REJECTED">مرفوضة</option>
          <option value="">الكل</option>
        </Select>
      </div>

      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد طلبات" />
    </AdminShell>
  );
}
