"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Spinner } from "@kawkab/ui";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface SimRow {
  id: string;
  name: string;
  status: string;
  tick: number;
  simYear: number;
  live: { running: boolean; ticksPerSecond: number; lastTickDurationMs: number } | null;
}

interface SnapshotRow {
  tick: number;
  simYear: number;
  hash: string;
  createdAt: string;
}

interface TickRow {
  tick: number;
  durationMs: number;
  eventCount: number;
}

export default function SimulationPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: sims, isLoading } = useQuery({
    queryKey: ["admin-planets"],
    queryFn: () => api<SimRow[]>("/api/admin/simulations"),
    refetchInterval: 5_000,
  });
  const { data: snapshots } = useQuery({
    queryKey: ["snapshots", selected],
    queryFn: () => api<SnapshotRow[]>(`/api/simulation/${selected}/snapshots`),
    enabled: !!selected,
    refetchInterval: 10_000,
  });
  const { data: ticks } = useQuery({
    queryKey: ["ticks", selected],
    queryFn: () => api<TickRow[]>(`/api/admin/ticks/${selected}?limit=60`),
    enabled: !!selected,
    refetchInterval: 5_000,
  });

  const act = async (path: string, body?: object) => {
    await api(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    void qc.invalidateQueries({ queryKey: ["admin-planets"] });
    void qc.invalidateQueries({ queryKey: ["snapshots", selected] });
  };

  return (
    <AdminShell>
      <h1 className="text-xl font-bold mb-4">مراقبة المحاكاة والتحكم</h1>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            {(sims ?? []).map((sim) => (
              <div key={sim.id} className={`rounded-lg border p-3 cursor-pointer ${selected === sim.id ? "border-tech" : "border-line"} bg-panel`} onClick={() => setSelected(sim.id)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${sim.live?.running ? "bg-nature" : "bg-dim"}`} />
                  <span className="font-medium text-sm flex-1">{sim.name}</span>
                  <Badge color="#38bdf8">tick {sim.tick}</Badge>
                  <span className="text-[11px] text-dim">{sim.live ? `${sim.live.lastTickDurationMs}ms/tick` : "—"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); void act(`/api/simulation/${sim.id}/start`, { ticksPerSecond: 1 }); }}>تشغيل ×1</Button>
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); void act(`/api/simulation/${sim.id}/start`, { ticksPerSecond: 5 }); }}>×5</Button>
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); void act(`/api/simulation/${sim.id}/pause`); }}>إيقاف</Button>
                  <Button variant="ghost" onClick={(e) => { e.stopPropagation(); void act(`/api/simulation/${sim.id}/step`, { ticks: 10 }); }}>+10 نبضات</Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            {selected ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-line bg-panel p-3">
                  <div className="text-sm font-semibold mb-2">اللقطات (Snapshots) — استرجاع</div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {(snapshots ?? []).map((snap) => (
                      <div key={snap.tick} className="flex items-center gap-2 text-xs border-b border-line/40 pb-1">
                        <span className="tabular-nums" dir="ltr">tick {snap.tick}</span>
                        <span className="text-dim tabular-nums" dir="ltr">year {snap.simYear}</span>
                        <span className="text-dim" dir="ltr">{snap.hash.slice(0, 8)}</span>
                        <span className="flex-1" />
                        <button
                          onClick={() => {
                            if (window.confirm(`استرجاع العالم إلى النبضة ${snap.tick}؟ ستمحى الأحداث اللاحقة.`)) {
                              void act(`/api/simulation/${selected}/rollback`, { tick: snap.tick });
                            }
                          }}
                          className="text-hazard hover:underline"
                        >
                          استرجاع
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-panel p-3">
                  <div className="text-sm font-semibold mb-2">زمن النبضة (آخر 60)</div>
                  <div className="flex items-end gap-[2px] h-24" dir="ltr">
                    {(ticks ?? []).slice().reverse().map((tick) => (
                      <div
                        key={tick.tick}
                        title={`tick ${tick.tick}: ${tick.durationMs}ms, ${tick.eventCount} events`}
                        className="bg-tech/70 rounded-t w-2"
                        style={{ height: `${Math.min(100, Math.max(4, (tick.durationMs / 200) * 100))}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-dim text-sm">اختر كوكبًا للمراقبة.</div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
