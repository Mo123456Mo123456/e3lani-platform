"use client";

import React, { useEffect, useState } from "react";
import { Panel, Badge, Button } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface UserRow {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  role: { name: string };
  profile?: { displayName: string; impactScore: number } | null;
  _count: { contributions: number };
}

const ROLES = [
  "visitor", "registered", "explorer", "life_maker", "civ_builder",
  "historian", "content_moderator", "simulation_manager", "system_admin", "super_admin",
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<UserRow[]>("/admin/users")
      .then(setUsers)
      .catch((e) => setError(String(e)));
  };
  useEffect(load, []);

  const changeRole = async (userId: string, role: string) => {
    try {
      await api("/admin/users/role", { method: "POST", body: { userId, role } });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const suspend = async (userId: string) => {
    try {
      await api(`/admin/users/${userId}/suspend`, { method: "POST" });
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>المستخدمون</h1>
      {error && <p style={{ color: "var(--planet-red)" }}>{error}</p>}
      <Panel>
        <table>
          <thead>
            <tr><th>البريد</th><th>الاسم</th><th>الدور</th><th>إضافات</th><th>الحالة</th><th>إجراءات</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td dir="ltr">{u.email}</td>
                <td>{u.profile?.displayName ?? "—"}</td>
                <td>
                  <select
                    className="input"
                    value={u.role.name}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u._count.contributions}</td>
                <td>
                  <Badge color={u.status === "active" ? "var(--planet-green)" : "var(--planet-red)"}>{u.status}</Badge>
                </td>
                <td>
                  {u.status === "active" && (
                    <Button variant="danger" onClick={() => suspend(u.id)} style={{ padding: "4px 10px", fontSize: 11 }}>
                      إيقاف
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Shell>
  );
}
