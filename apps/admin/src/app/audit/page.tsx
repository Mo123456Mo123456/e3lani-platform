'use client';

import * as React from 'react';
import { Badge, Input } from '@e3lani/ui';
import { AdminShell } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
  ip: string | null;
  actorAdmin: { id: string; name: string; email: string } | null;
}

export default function AdminAuditPage() {
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [entityType, setEntityType] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    void adminFetch<{ items: AuditRow[] }>(
      `/admin/audit-logs?limit=50${entityType ? `&entityType=${entityType}` : ''}`,
    )
      .then((page) => setRows(page.items))
      .finally(() => setLoading(false));
  }, [entityType]);

  const columns: Column<AuditRow>[] = [
    { key: 'action', header: 'الإجراء', render: (row) => <Badge tone="neutral">{row.action}</Badge> },
    {
      key: 'entity',
      header: 'الكيان',
      render: (row) => (
        <span className="text-xs">
          {row.entityType}
          {row.entityId ? ` · ${row.entityId.slice(0, 10)}…` : ''}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'المنفّذ',
      render: (row) => <span className="text-xs">{row.actorAdmin?.email ?? 'النظام / مستخدم'}</span>,
    },
    {
      key: 'reason',
      header: 'السبب',
      render: (row) => <span className="line-clamp-2 text-xs">{row.reason ?? '—'}</span>,
    },
    {
      key: 'time',
      header: 'الوقت',
      render: (row) => (
        <span className="text-xs">{new Date(row.createdAt).toLocaleString('ar-SA')}</span>
      ),
    },
  ];

  return (
    <AdminShell title="سجل الإجراءات">
      <div className="mb-3">
        <Input
          placeholder="تصفية حسب الكيان (Ad / User / Payment …)"
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          className="max-w-xs"
        />
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد سجلات" />
    </AdminShell>
  );
}
