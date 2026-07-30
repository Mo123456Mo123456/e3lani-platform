"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Spinner } from "@kawkab/ui";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface ModerationRow {
  id: string;
  text: string;
  status: string;
  score: number;
  reasons: string[];
  createdAt: string;
  contribution: { id: string; category: string; status: string; user: { displayName: string; email: string } } | null;
}

interface ContributionRow {
  id: string;
  category: string;
  rawText: string;
  status: string;
  sandbox: boolean;
  impactScore: number;
  eventCount: number;
  createdAt: string;
  user: { displayName: string; email: string };
}

export default function ContributionsPage() {
  const qc = useQueryClient();
  const { data: queue, isLoading } = useQuery({
    queryKey: ["mod-queue"],
    queryFn: () => api<ModerationRow[]>("/api/moderation/queue?status=flagged"),
    refetchInterval: 20_000,
  });
  const { data: contributions } = useQuery({
    queryKey: ["admin-contributions"],
    queryFn: () => api<ContributionRow[]>("/api/admin/contributions"),
    refetchInterval: 30_000,
  });

  const review = async (id: string, status: "approved" | "rejected") => {
    await api(`/api/moderation/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    void qc.invalidateQueries({ queryKey: ["mod-queue"] });
    void qc.invalidateQueries({ queryKey: ["admin-contributions"] });
  };

  return (
    <AdminShell>
      <h1 className="text-xl font-bold mb-4">الإضافات والإشراف</h1>
      <h2 className="text-sm font-semibold text-hazard mb-2">طابور المراجعة ({queue?.length ?? 0})</h2>
      {isLoading ? (
        <Spinner />
      ) : (queue ?? []).length === 0 ? (
        <div className="text-dim text-sm mb-6">لا عناصر معلّقة.</div>
      ) : (
        <div className="space-y-2 mb-6">
          {(queue ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-hazard/50 bg-panel p-3">
              <div className="text-sm">{row.text}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {row.reasons.map((r) => (
                  <Badge key={r} color="#fb923c">{r}</Badge>
                ))}
                <span className="text-[11px] text-dim">score {row.score.toFixed(2)}</span>
                <span className="text-[11px] text-dim">{row.contribution?.user.displayName}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => review(row.id, "approved")} className="text-xs px-3 py-1 rounded bg-nature/20 text-nature">قبول</button>
                <button onClick={() => review(row.id, "rejected")} className="text-xs px-3 py-1 rounded bg-war/20 text-war">رفض</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-dim mb-2">كل الإضافات</h2>
      <div className="rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panelAlt text-dim text-xs">
            <tr>
              <th className="text-start p-2">النص</th>
              <th className="text-start p-2">الفئة</th>
              <th className="text-start p-2">الحالة</th>
              <th className="text-start p-2">المستخدم</th>
              <th className="text-start p-2">الأثر</th>
            </tr>
          </thead>
          <tbody>
            {(contributions ?? []).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-2 max-w-[280px] truncate">{c.rawText}</td>
                <td className="p-2">{c.category}</td>
                <td className="p-2">
                  <Badge color={c.status === "active" ? "#34d399" : c.status === "rejected" ? "#f87171" : "#8b98a9"}>{c.status}</Badge>
                </td>
                <td className="p-2 text-xs text-dim">{c.user.displayName}</td>
                <td className="p-2 tabular-nums text-xs">{c.eventCount} حدث · {c.impactScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
