"use client";

import React, { useEffect, useState } from "react";
import { Panel } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface AuditRow {
  id: string;
  action: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    api<AuditRow[]>("/admin/audit-logs").then(setRows).catch(() => {});
  }, []);

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>سجل العمليات</h1>
      <Panel>
        <table>
          <thead>
            <tr><th>العملية</th><th>الهدف</th><th>البيانات</th><th>التاريخ</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.action}</td>
                <td>{r.targetType ?? "—"} {r.targetId?.slice(0, 8) ?? ""}</td>
                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {JSON.stringify(r.metadata).slice(0, 80)}
                </td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Shell>
  );
}
