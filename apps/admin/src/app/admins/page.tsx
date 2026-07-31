'use client';

import * as React from 'react';
import { ADMIN_ROLE_LABELS, type AdminRoleKey } from '@e3lani/config';
import { Badge, Button, Card, Input, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRoleKey;
  isActive: boolean;
  permissions: string[];
  lastLoginAt: string | null;
}

export default function AdminTeamPage() {
  const canWrite = useCan('admins.write');
  const [rows, setRows] = React.useState<AdminRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ name: '', email: '', password: '', role: 'SUPPORT' });
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminFetch<AdminRow[]>('/admin/admins'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await adminFetch('/admin/admins', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', password: '', role: 'SUPPORT' });
      setMessage('تم إنشاء الحساب');
      await load();
    } catch (error: any) {
      setMessage(error.message ?? 'تعذّر الإنشاء');
    }
  };

  const toggle = async (row: AdminRow) => {
    await adminFetch(`/admin/admins/${row.id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    await load();
  };

  const columns: Column<AdminRow>[] = [
    {
      key: 'admin',
      header: 'العضو',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.name}</p>
          <p className="text-xs text-ink-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      render: (row) => <Badge tone="primary">{ADMIN_ROLE_LABELS[row.role]?.ar ?? row.role}</Badge>,
    },
    {
      key: 'permissions',
      header: 'عدد الصلاحيات',
      render: (row) => <span className="text-sm">{row.permissions.length}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'danger'}>{row.isActive ? 'مفعّل' : 'معطّل'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canWrite ? (
          <Button size="sm" variant="outline" onClick={() => void toggle(row)}>
            {row.isActive ? 'تعطيل' : 'تفعيل'}
          </Button>
        ) : null,
    },
  ];

  return (
    <AdminShell title="فريق الإدارة">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <DataTable rows={rows} columns={columns} loading={loading} />

        {canWrite ? (
          <Card className="space-y-3 p-4">
            <h2 className="font-extrabold">إضافة عضو</h2>
            <form onSubmit={create} className="space-y-3">
              <Input
                label="الاسم"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
              <Input
                label="البريد الإلكتروني"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
              <Input
                label="كلمة المرور"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                hint="١٠ أحرف على الأقل مع حرف كبير وصغير ورقم"
              />
              <Select
                label="الدور"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              >
                {Object.entries(ADMIN_ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label.ar}
                  </option>
                ))}
              </Select>
              {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
              <Button type="submit">إنشاء</Button>
            </form>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
