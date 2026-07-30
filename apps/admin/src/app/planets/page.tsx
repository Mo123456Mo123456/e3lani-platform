"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Spinner } from "@kawkab/ui";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

interface PlanetRow {
  id: string;
  name: string;
  seed: string;
  status: string;
  tick: number;
  simYear: number;
  live: { running: boolean; ticksPerSecond: number } | null;
}

export default function PlanetsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-planets"],
    queryFn: () => api<PlanetRow[]>("/api/admin/simulations"),
    refetchInterval: 10_000,
  });

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/worlds", { method: "POST", body: JSON.stringify({ name, seed: seed || undefined }) });
      setName("");
      setSeed("");
      void qc.invalidateQueries({ queryKey: ["admin-planets"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <h1 className="text-xl font-bold mb-4">الكواكب</h1>
      <div className="flex gap-2 mb-4 max-w-xl">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الكوكب" className="flex-1 bg-bg border border-line rounded px-3 py-1.5 text-sm focus:border-tech outline-none" />
        <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="البذرة (اختياري)" className="flex-1 bg-bg border border-line rounded px-3 py-1.5 text-sm focus:border-tech outline-none" dir="ltr" />
        <Button onClick={create} disabled={busy || !name.trim()}>توليد</Button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel p-3">
              <span className={`w-2.5 h-2.5 rounded-full ${p.live?.running ? "bg-nature" : "bg-dim"}`} />
              <div className="flex-1">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-dim" dir="ltr">seed: {p.seed}</div>
              </div>
              <Badge color="#38bdf8">tick {p.tick}</Badge>
              <span className="text-xs text-dim tabular-nums" dir="ltr">year {p.simYear}</span>
              <span className="text-xs text-dim">{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
