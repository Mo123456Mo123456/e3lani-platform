"use client";

import { useQuery } from "@tanstack/react-query";
import { Panel, Spinner } from "@kawkab/ui";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface Overview {
  users: number;
  planets: number;
  contributions: number;
  events: number;
  ai: { costUsd: number; tokensIn: number; tokensOut: number };
  pendingModeration: number;
}

export default function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api<Overview>("/api/admin/overview"),
    refetchInterval: 30_000,
  });

  return (
    <AdminShell>
      <h1 className="text-xl font-bold mb-4">نظرة عامة</h1>
      {isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
          <Stat label="المستخدمون" value={data.users} />
          <Stat label="الكواكب" value={data.planets} />
          <Stat label="الإضافات" value={data.contributions} />
          <Stat label="الأحداث المسجلة" value={data.events} />
          <Stat label="تكلفة الذكاء الاصطناعي ($)" value={data.ai.costUsd.toFixed(4)} />
          <Stat label="بانتظار المراجعة" value={data.pendingModeration} highlight={data.pendingModeration > 0} />
          <div className="hidden"><Panel /></div>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-hazard" : "border-line"} bg-panel`}>
      <div className="text-xs text-dim">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-hazard" : ""}`}>{value}</div>
    </div>
  );
}
