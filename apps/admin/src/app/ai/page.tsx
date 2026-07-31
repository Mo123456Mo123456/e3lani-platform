"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@planet/ui";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function AiPage() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["ai-requests", page],
    queryFn: () => api().adminAiRequests(page),
  });
  const { data: providers } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api().get<{ providers: Array<{ name: string; configured: boolean; sandbox: boolean }> }>("/admin/ai-providers").catch(() => null),
    retry: false,
  });

  return (
    <AdminShell>
      <div className="admin-title">الذكاء الاصطناعي ({data?.total ?? "…"} طلب)</div>
      <Card style={{ marginBottom: 14 }}>
        <strong>المزوّدون</strong>
        <div className="pb-chip-row" style={{ marginTop: 8 }}>
          {(providers?.providers ?? []).map((p) => (
            <Badge key={p.name} tone={p.configured && !p.sandbox ? "nature" : "warning"}>
              {p.name}: {p.configured ? "مُعدّ" : "غير مُعدّ"}{p.sandbox ? " (sandbox)" : ""}
            </Badge>
          ))}
        </div>
      </Card>
      <div className="table-wrap">
        <table className="pb-table">
          <thead>
            <tr>
              <th>النوع</th><th>المزوّد</th><th>sandbox</th><th>tokens</th><th>التكلفة</th>
              <th>الزمن</th><th>الحالة</th><th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.kind}</td>
                <td>{r.provider}</td>
                <td>{r.sandbox ? <Badge tone="warning">sandbox</Badge> : <Badge tone="nature">live</Badge>}</td>
                <td className="pb-mono">{r.tokensIn}/{r.tokensOut}</td>
                <td className="pb-mono">${r.costUsd.toFixed(5)}</td>
                <td className="pb-mono">{r.latencyMs}ms</td>
                <td>{r.status === "ok" ? <Badge tone="nature">ok</Badge> : <Badge tone="danger">{r.status}</Badge>}</td>
                <td className="pb-dim" style={{ fontSize: 11 }}>{new Date(r.createdAt).toLocaleString("ar")}</td>
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
