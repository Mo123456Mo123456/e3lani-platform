'use client';

import * as React from 'react';
import { AD_STATUSES } from '@e3lani/types';
import { Badge, Button, Input, Select, formatNumber } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AdminAd {
  id: string;
  title: string;
  status: string;
  owner: { id: string; name: string | null; phone: string };
  city: string;
  category: string;
  price: number | null;
  thumbnailUrl: string | null;
  reportsCount: number;
  viewsCount: number;
  publishedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_PAYMENT: 'بانتظار الدفع',
  ACTIVE: 'نشط',
  PAUSED: 'متوقف',
  EXPIRED: 'منتهي',
  REJECTED: 'مرفوض',
  REMOVED: 'محذوف',
};

export default function AdminAdsPage() {
  const canModerate = useCan('ads.moderate');
  const [rows, setRows] = React.useState<AdminAd[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      const page = await adminFetch<{ items: AdminAd[] }>(`/admin/ads?${params}`);
      setRows(page.items);
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (id: string, action: 'SUSPEND' | 'RESTORE' | 'DELETE') => {
    const reason = window.prompt('سبب الإجراء (يُسجّل في سجل الإجراءات ويُرسل لصاحب الإعلان)');
    if (!reason || reason.trim().length < 3) return;
    await adminFetch(`/admin/ads/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason, notifyOwner: true }),
    });
    void load();
  };

  const columns: Column<AdminAd>[] = [
    {
      key: 'ad',
      header: 'الإعلان',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-12 w-10 shrink-0 overflow-hidden rounded bg-surface">
            {row.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 font-semibold">{row.title}</p>
            <p className="text-xs text-ink-muted">
              {row.category} · {row.city}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'المعلن',
      render: (row) => (
        <div>
          <p className="font-medium">{row.owner.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.owner.phone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'ACTIVE' ? 'success' : row.status === 'REMOVED' ? 'danger' : 'neutral'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'stats',
      header: 'مؤشرات',
      render: (row) => (
        <div className="text-xs text-ink-muted">
          <p>{formatNumber(row.viewsCount)} مشاهدة</p>
          {row.reportsCount ? <p className="text-danger">{row.reportsCount} بلاغ</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) =>
        canModerate ? (
          <div className="flex flex-wrap gap-1">
            {row.status === 'ACTIVE' ? (
              <Button size="sm" variant="outline" onClick={() => void moderate(row.id, 'SUSPEND')}>
                إيقاف
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void moderate(row.id, 'RESTORE')}>
                إعادة تفعيل
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => void moderate(row.id, 'DELETE')}>
              حذف
            </Button>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">للاطلاع فقط</span>
        ),
    },
  ];

  return (
    <AdminShell title="الإعلانات">
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          placeholder="بحث بالعنوان"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[180px]">
          <option value="">كل الحالات</option>
          {AD_STATUSES.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABEL[item]}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void load()}>
          تحديث
        </Button>
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد إعلانات" />
    </AdminShell>
  );
}
