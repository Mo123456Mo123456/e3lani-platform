"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Sparkline } from "@planet/ui";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function MetricsPage() {
  const { data: metrics } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api().adminMetrics(),
    refetchInterval: 15_000,
  });
  const { data: aiDaily } = useQuery({
    queryKey: ["ai-daily"],
    queryFn: () => api().get<Array<{ day: string; costUsd: number; requests: number }>>("/admin/ai-usage-daily"),
  });

  const cards: Array<{ label: string; value: number | string; tone?: string }> = [
    { label: "المستخدمون", value: metrics?.users ?? "—" },
    { label: "الإضافات", value: metrics?.contributions ?? "—" },
    { label: "الأحداث", value: metrics?.events ?? "—" },
    { label: "الكواكب", value: metrics?.planets ?? "—" },
    { label: "طلبات AI", value: metrics?.aiRequests ?? "—" },
    { label: "تكلفة AI ($)", value: metrics?.aiCostUsd?.toFixed(4) ?? "0" },
    { label: "زمن AI (ms)", value: metrics?.aiAvgLatencyMs ?? "—" },
    { label: "محجوب (إشراف)", value: metrics?.moderationBlocked ?? "—" },
    { label: "اتصالات WS", value: metrics?.activeWsConnections ?? "—" },
  ];

  return (
    <AdminShell>
      <div className="admin-title">المقاييس التشغيلية</div>
      <div className="metric-grid">
        {cards.map((c) => (
          <div key={c.label} className="metric-card">
            <div className="metric-value">{c.value}</div>
            <div className="metric-label">{c.label}</div>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <strong>الإضافات حسب الفئة</strong>
          <Badge tone="tech">30 يوم</Badge>
        </div>
        <div className="pb-chip-row">
          {Object.entries(metrics?.contributionsByCategory ?? {}).map(([cat, count]) => (
            <Badge key={cat} tone="nature">{cat}: {count}</Badge>
          ))}
        </div>
      </Card>
      <div style={{ height: 14 }} />
      <Card>
        <strong>طلبات الذكاء الاصطناعي اليومية</strong>
        <div style={{ marginTop: 10 }}>
          <Sparkline values={(aiDaily ?? []).map((d) => d.requests)} width={520} height={60} />
          <div className="pb-dim" style={{ fontSize: 12, marginTop: 6 }}>
            آخر يوم: {(aiDaily ?? []).at(-1)?.requests ?? 0} طلب · تكلفة {(aiDaily ?? []).at(-1)?.costUsd.toFixed(4) ?? 0}$
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}
