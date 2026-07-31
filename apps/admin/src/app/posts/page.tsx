'use client';

import * as React from 'react';
import { Badge, Button } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AdminPost {
  id: string;
  caption: string;
  isActive: boolean;
  owner: { id: string; name: string | null; phone: string };
  thumbnailUrl: string | null;
  reportsCount: number;
}

export default function AdminPostsPage() {
  const canModerate = useCan('posts.moderate');
  const [rows, setRows] = React.useState<AdminPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const page = await adminFetch<{ items: AdminPost[] }>('/admin/posts?limit=25');
      setRows(page.items);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (row: AdminPost) => {
    const reason = window.prompt(row.isActive ? 'سبب الإيقاف' : 'سبب إعادة التفعيل');
    if (!reason || reason.trim().length < 3) return;
    await adminFetch(`/admin/posts/${row.id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ isActive: !row.isActive, reason }),
    });
    void load();
  };

  const columns: Column<AdminPost>[] = [
    {
      key: 'post',
      header: 'المنشور',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-surface">
            {row.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <p className="line-clamp-2 max-w-md text-sm">{row.caption}</p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'الحساب',
      render: (row) => (
        <div>
          <p>{row.owner.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.owner.phone}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'ظاهر' : 'موقوف'}</Badge>
      ),
    },
    {
      key: 'reports',
      header: 'البلاغات',
      render: (row) => (row.reportsCount ? <span className="text-danger">{row.reportsCount}</span> : '—'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canModerate ? (
          <Button size="sm" variant="outline" onClick={() => void moderate(row)}>
            {row.isActive ? 'إيقاف' : 'إعادة تفعيل'}
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminShell title="المنشورات المجانية">
      <p className="mb-3 text-sm text-ink-muted">
        المنشورات كيان مستقل عن الإعلانات وتظهر فقط داخل صفحة صاحب الحساب.
      </p>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد منشورات" />
    </AdminShell>
  );
}
