"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@planet/ui";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => api().adminAuditLogs(page),
  });

  return (
    <AdminShell>
      <div className="admin-title">سجل العمليات ({data?.total ?? "…"})</div>
      <div className="table-wrap">
        <table className="pb-table">
          <thead>
            <tr><th>الفعل</th><th>الفاعل</th><th>الهدف</th><th>IP</th><th>التفاصيل</th><th>الوقت</th></tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((log) => (
              <tr key={log.id}>
                <td><Badge tone="tech">{log.action}</Badge></td>
                <td className="pb-dim" style={{ fontSize: 12 }} dir="ltr">{log.actorEmail ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{log.targetType ?? "—"}:{(log.targetId ?? "").slice(0, 8)}</td>
                <td className="pb-mono" style={{ fontSize: 11 }}>{log.ip ?? "—"}</td>
                <td className="pb-mono" style={{ fontSize: 10, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {JSON.stringify(log.detail).slice(0, 80)}
                </td>
                <td className="pb-dim" style={{ fontSize: 11 }}>{new Date(log.createdAt).toLocaleString("ar")}</td>
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
