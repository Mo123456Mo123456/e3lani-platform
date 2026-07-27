'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    api.adminUsers().then(setUsers).catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="stack">
      <PageHeader title="المستخدمون" description="آخر المستخدمين وحالات الأدوار والتوثيق." />
      <ErrorMessage message={error} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>المستخدم</th>
              <th>الجوال</th>
              <th>الأدوار</th>
              <th>المدينة</th>
              <th>التوثيق</th>
              <th>تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName || user.brandProfile?.nameAr || user.id}</strong>
                  <div className="muted">{user.email || '-'}</div>
                </td>
                <td>{user.phone}</td>
                <td className="toolbar">
                  {(user.roles || []).map((role: string) => (
                    <StatusBadge key={role}>{role}</StatusBadge>
                  ))}
                </td>
                <td>{user.city?.nameAr || '-'}</td>
                <td>
                  <StatusBadge>{user.verification?.status || 'NOT_REQUESTED'}</StatusBadge>
                </td>
                <td>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && !error ? <EmptyState>لا يوجد مستخدمون بعد.</EmptyState> : null}
    </div>
  );
}
