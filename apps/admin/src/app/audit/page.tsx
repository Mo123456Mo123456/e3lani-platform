"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@kawkab/ui";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api<{ items: AuditRow[]; total: number }>(`/api/admin/audit-logs?page=${page}`),
    refetchInterval: 15_000,
  });

  return (
    <AdminShell>
      <h1 className="text-xl font-bold mb-4">سجل العمليات</h1>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="rounded-lg border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panelAlt text-dim text-xs">
              <tr>
                <th className="text-start p-2">الوقت</th>
                <th className="text-start p-2">العملية</th>
                <th className="text-start p-2">المستخدم</th>
                <th className="text-start p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="p-2 text-xs text-dim tabular-nums" dir="ltr">{new Date(row.createdAt).toLocaleString("ar-EG")}</td>
                  <td className="p-2 text-xs" dir="ltr">{row.action}</td>
                  <td className="p-2 text-xs text-dim">{row.userId ?? "anon"}</td>
                  <td className="p-2 text-xs text-dim" dir="ltr">{row.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-center gap-2 p-2 border-t border-line">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">‹</button>
            <span className="text-xs text-dim py-1 tabular-nums">{data?.total ?? 0}</span>
            <button disabled={(data?.items.length ?? 0) < 50} onClick={() => setPage((p) => p + 1)} className="text-xs px-3 py-1 rounded border border-line text-dim disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
