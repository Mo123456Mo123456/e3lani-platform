'use client';

import * as React from 'react';
import { Badge, Button, Input, formatNumber } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AdminUser {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  accountType: string;
  status: string;
  isVerified: boolean;
  city: string | null;
  businessName: string | null;
  businessVerified: boolean;
  adsCount: number;
  postsCount: number;
}

const TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL: 'فرد',
  STORE: 'متجر',
  BRAND: 'براند',
  COMPANY: 'شركة',
};

export default function AdminUsersPage() {
  const canSuspend = useCan('users.suspend');
  const canVerify = useCan('business.verify');
  const [rows, setRows] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const page = await adminFetch<{ items: AdminUser[] }>(
        `/admin/users?limit=25${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      );
      setRows(page.items);
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = async (row: AdminUser) => {
    const suspend = row.status === 'ACTIVE';
    const reason = window.prompt(suspend ? 'سبب الإيقاف' : 'سبب إعادة التفعيل');
    if (!reason || reason.trim().length < 3) return;
    await adminFetch(`/admin/users/${row.id}/${suspend ? 'suspend' : 'activate'}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    void load();
  };

  const toggleVerify = async (row: AdminUser) => {
    await adminFetch(`/admin/users/${row.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ verified: !row.businessVerified }),
    });
    void load();
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'المستخدم',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.businessName ?? row.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">
            {row.phone}
            {row.email ? ` · ${row.email}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone="neutral">{TYPE_LABEL[row.accountType] ?? row.accountType}</Badge>
          {row.businessVerified ? <Badge tone="success">موثّق</Badge> : null}
        </div>
      ),
    },
    { key: 'city', header: 'المدينة', render: (row) => row.city ?? '—' },
    {
      key: 'counts',
      header: 'المحتوى',
      render: (row) => (
        <span className="text-xs text-ink-muted">
          {formatNumber(row.adsCount)} إعلان · {formatNumber(row.postsCount)} منشور
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
          {row.status === 'ACTIVE' ? 'نشط' : 'موقوف'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canSuspend ? (
            <Button size="sm" variant="outline" onClick={() => void toggleStatus(row)}>
              {row.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
            </Button>
          ) : null}
          {canVerify && row.accountType !== 'INDIVIDUAL' ? (
            <Button size="sm" variant="ghost" onClick={() => void toggleVerify(row)}>
              {row.businessVerified ? 'إلغاء التوثيق' : 'توثيق'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdminShell title="المستخدمون">
      <div className="mb-3 flex gap-2">
        <Input
          placeholder="بحث بالاسم أو الجوال"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={() => void load()}>
          بحث
        </Button>
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا يوجد مستخدمون" />
    </AdminShell>
  );
}
