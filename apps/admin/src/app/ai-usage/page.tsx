"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Spinner } from "@kawkab/ui";
import type { AiUsageRow } from "@kawkab/shared-types";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

export default function AiUsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api<{ totalCostUsd: number; rows: AiUsageRow[] }>("/api/admin/ai-usage?days=7"),
    refetchInterval: 30_000,
  });

  return (
    <AdminShell>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-xl font-bold">استهلاك الذكاء الاصطناعي (7 أيام)</h1>
        <Badge color="#f5c452">${(data?.totalCostUsd ?? 0).toFixed(4)}</Badge>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="rounded-lg border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panelAlt text-dim text-xs">
              <tr>
                <th className="text-start p-2">الوقت</th>
                <th className="text-start p-2">المزود</th>
                <th className="text-start p-2">العملية</th>
                <th className="text-start p-2">الرموز</th>
                <th className="text-start p-2">التكلفة</th>
                <th className="text-start p-2">زمن الاستجابة</th>
                <th className="text-start p-2">الوضع</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-2 text-xs text-dim tabular-nums" dir="ltr">{new Date(row.createdAt).toLocaleString("ar-EG")}</td>
                  <td className="p-2">{row.provider}/{row.model}</td>
                  <td className="p-2">{row.operation}</td>
                  <td className="p-2 tabular-nums">{row.tokensIn + row.tokensOut}</td>
                  <td className="p-2 tabular-nums">${row.costUsd.toFixed(5)}</td>
                  <td className="p-2 tabular-nums">{row.latencyMs}ms</td>
                  <td className="p-2">{row.sandbox ? <Badge color="#facc15">sandbox</Badge> : <Badge color="#34d399">live</Badge>}</td>
                </tr>
              ))}
              {(data?.rows ?? []).length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-dim text-sm">لا طلبات مسجلة بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
