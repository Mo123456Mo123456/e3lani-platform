'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { track } from '@planet/analytics';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
  roles: string[];
};

export default function UsersPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserRow[]; roles: string[] }>('/admin/users', token, {
        search: search || undefined,
      });
      setUsers(data.users);
      setRoles(data.roles);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [token, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(userId: string, role: string) {
    setBusy(userId);
    try {
      await api.patch(`/admin/users/${userId}/roles`, token, { roles: [role], action: 'set' });
      track('role_change', { userId, role });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Role update failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Users</h1>
          <p className="text-sm text-fg-muted">Search and change RBAC roles</p>
        </div>
        <input
          className="admin-input max-w-xs"
          placeholder="Search email / name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Roles</th>
              <th>Set role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-fg-muted">{u.email}</div>
                </td>
                <td className="text-xs">{u.status}</td>
                <td className="font-mono text-xs">{u.roles.join(', ') || '—'}</td>
                <td>
                  <select
                    className="admin-input max-w-[160px]"
                    disabled={busy === u.id}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void setRole(u.id, e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Change…</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
