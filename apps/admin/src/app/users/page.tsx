"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Spinner } from "@kawkab/ui";
import { USER_ROLES, type UserRole } from "@kawkab/shared-types";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  bannedAt: string | null;
  _count: { contributions: number };
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", q, page],
    queryFn: () => api<{ items: UserRow[]; total: number }>(`/api/admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });

  const setRole = async (id: string, role: UserRole) => {
    await api(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const setBan = async (id: string, banned: boolean) => {
    await api(`/api/admin/users/${id}/ban`, { method: "PATCH", body: JSON.stringify({ banned }) });
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <AdminShell>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">المستخدمون</h1>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="بحث بالبريد أو الاسم…" className="bg-bg border border-line rounded px-3 py-1.5 text-sm w-64 focus:border-tech outline-none" />
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="rounded-lg border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panelAlt text-dim text-xs">
              <tr>
                <th className="text-start p-2">المستخدم</th>
                <th className="text-start p-2">الدور</th>
                <th className="text-start p-2">الإضافات</th>
                <th className="text-start p-2">آخر دخول</th>
                <th className="text-start p-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="p-2">
                    <div className="font-medium">{u.displayName}</div>
                    <div className="text-xs text-dim" dir="ltr">{u.email}</div>
                  </td>
                  <td className="p-2">
                    <select
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value as UserRole)}
                      className="bg-bg border border-line rounded px-2 py-1 text-xs"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 tabular-nums">{u._count.contributions}</td>
                  <td className="p-2 text-xs text-dim tabular-nums" dir="ltr">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("ar-EG") : "—"}
                  </td>
                  <td className="p-2">
                    {u.bannedAt ? (
                      <>
                        <Badge color="#f87171">محظور</Badge>
                        <button onClick={() => setBan(u.id, false)} className="text-xs text-tech ms-2">فك الحظر</button>
                      </>
                    ) : (
                      <button onClick={() => setBan(u.id, true)} className="text-xs text-war">حظر</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-center gap-2 p-2 border-t border-line">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">‹</button>
            <span className="text-xs text-dim py-1 tabular-nums">{data?.total ?? 0}</span>
            <button disabled={(data?.items.length ?? 0) < 25} onClick={() => setPage((p) => p + 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
