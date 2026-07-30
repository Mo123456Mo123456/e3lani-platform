"use client";

import { AdminShell } from "@/components/AdminShell";
import { type AdminUser, formatDate } from "@/lib/api";
import { useAdminResource } from "@/lib/use-admin-resource";

export default function UsersPage() {
  const users = useAdminResource<AdminUser[]>("/admin/users");

  return (
    <AdminShell>
      <main>
        <div className="page-header">
          <div>
            <p className="eyebrow">Identity</p>
            <h2>Users</h2>
            <p>Latest users returned by the protected admin user endpoint.</p>
          </div>
          <button className="ghost" type="button" onClick={users.reload}>
            Refresh
          </button>
        </div>
        {users.error ? <div className="error">{users.error}</div> : null}
        <section className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Level</th>
                <th>XP</th>
                <th>Locale</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.displayName}</td>
                  <td>
                    <span className="pill">{user.role}</span>
                  </td>
                  <td>{user.level ?? "-"}</td>
                  <td>{user.xp ?? "-"}</td>
                  <td>{user.locale ?? "-"}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {!users.loading && (users.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7}>No users returned.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </main>
    </AdminShell>
  );
}
