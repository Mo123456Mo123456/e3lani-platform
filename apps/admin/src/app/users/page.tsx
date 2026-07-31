"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button } from "@planet/ui";
import { ROLES } from "@planet/shared-types";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => api().adminUsers(page),
  });

  async function setRole(userId: string, role: string) {
    await api().adminUpdateUser(userId, { role });
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function toggleSuspend(userId: string, suspended: boolean) {
    await api().adminUpdateUser(userId, { suspended: !suspended });
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <AdminShell>
      <div className="admin-title">المستخدمون ({data?.total ?? "…"})</div>
      <div className="table-wrap">
        <table className="pb-table">
          <thead>
            <tr>
              <th>البريد</th><th>الاسم</th><th>الدور</th><th>إضافات</th><th>الحالة</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <tr key={u.id}>
                <td dir="ltr">{u.email}</td>
                <td>{u.displayName}</td>
                <td>
                  <select
                    className="pb-select"
                    style={{ width: 130, padding: "4px 8px" }}
                    value={u.role}
                    onChange={(e) => setRole(u.id, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>{u.contributionCount}</td>
                <td>
                  {"suspended" in u && (u as { suspended?: boolean }).suspended ? (
                    <Badge tone="danger">موقوف</Badge>
                  ) : (
                    <Badge tone="nature">نشط</Badge>
                  )}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant={("suspended" in u && (u as { suspended?: boolean }).suspended) ? "nature" : "danger"}
                    onClick={() => toggleSuspend(u.id, ("suspended" in u && (u as { suspended?: boolean }).suspended) ?? false)}
                  >
                    {("suspended" in u && (u as { suspended?: boolean }).suspended) ? "تفعيل" : "إيقاف"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
        <button className="hud-chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
        <span className="pb-dim">{page}</span>
        <button className="hud-chip" onClick={() => setPage((p) => p + 1)}>→</button>
      </div>
    </AdminShell>
  );
}
