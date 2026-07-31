"use client";

import React, { useEffect, useState } from "react";
import { Panel, Badge } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface AiRequestRow {
  id: string;
  provider: string;
  kind: string;
  costUsd: number;
  sandbox: boolean;
  status: string;
  durationMs: number;
  createdAt: string;
}

interface Providers {
  active: string;
  providers: { name: string; live: boolean; sandbox: boolean }[];
}

export default function AiPage() {
  const [rows, setRows] = useState<AiRequestRow[]>([]);
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    api<AiRequestRow[]>("/admin/ai-usage").then(setRows).catch(() => {});
    api<Providers>("/admin/ai-providers").then(setProviders).catch(() => {});
  }, []);

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>استهلاك الذكاء الاصطناعي</h1>
      {providers && (
        <Panel title="المزودون" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {providers.providers.map((p) => (
              <Badge key={p.name} color={p.sandbox ? "var(--planet-orange)" : p.live ? "var(--planet-green)" : "var(--planet-text-dim)"}>
                {p.name}: {p.sandbox ? "sandbox" : p.live ? "live" : "no key"}
              </Badge>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="الطلبات الأخيرة">
        <table>
          <thead>
            <tr><th>المزود</th><th>النوع</th><th>sandbox</th><th>التكلفة</th><th>المدة</th><th>الحالة</th><th>التاريخ</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.provider}</td>
                <td>{r.kind}</td>
                <td>{r.sandbox ? <Badge color="var(--planet-orange)">sandbox</Badge> : <Badge color="var(--planet-green)">live</Badge>}</td>
                <td>${r.costUsd.toFixed(5)}</td>
                <td>{r.durationMs}ms</td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Shell>
  );
}
