'use client';

import * as React from 'react';
import { halalasToSar } from '@e3lani/config';
import { Badge, Select, formatNumber } from '@e3lani/ui';
import { AdminShell } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface PaymentRow {
  id: string;
  amountHalalas: number;
  status: string;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string | null; phone: string };
  ad: { id: string; title: string } | null;
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    void adminFetch<{ items: PaymentRow[] }>(`/admin/payments?limit=25${status ? `&status=${status}` : ''}`)
      .then((page) => setRows(page.items))
      .finally(() => setLoading(false));
  }, [status]);

  const columns: Column<PaymentRow>[] = [
    {
      key: 'amount',
      header: 'المبلغ',
      render: (row) => <span className="font-bold">{formatNumber(halalasToSar(row.amountHalalas))} ر.س</span>,
    },
    {
      key: 'user',
      header: 'العميل',
      render: (row) => (
        <div>
          <p>{row.user?.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.user?.phone}</p>
        </div>
      ),
    },
    { key: 'ad', header: 'الإعلان', render: (row) => row.ad?.title ?? '—' },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'PAID' ? 'success' : row.status === 'FAILED' ? 'danger' : 'neutral'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'provider',
      header: 'المزوّد',
      render: (row) => (
        <div className="text-xs">
          <p>{row.provider}</p>
          <p className="text-ink-muted">{row.providerRef ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (row) => (
        <span className="text-xs">{new Date(row.createdAt).toLocaleString('ar-SA')}</span>
      ),
    },
  ];

  return (
    <AdminShell title="المدفوعات">
      <div className="mb-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[200px]">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد الانتظار</option>
          <option value="PAID">مدفوعة</option>
          <option value="FAILED">فاشلة</option>
          <option value="REFUNDED">مستردة</option>
        </Select>
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد عمليات دفع" />
    </AdminShell>
  );
}
