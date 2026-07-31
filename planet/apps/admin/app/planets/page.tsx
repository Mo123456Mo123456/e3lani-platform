"use client";

import React, { useEffect, useState } from "react";
import { Panel, Badge, Button, Stat } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface PlanetRow {
  id: string;
  name: string;
  seed: number;
  status: string;
  currentTick: number;
  yearsPerTick: number;
  era: string;
  _count: { civilizations: number; events: number; contributions: number };
}

export default function PlanetsPage() {
  const [planets, setPlanets] = useState<PlanetRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<PlanetRow[]>("/worlds").then(setPlanets).catch((e) => setMessage(String(e)));
  };
  useEffect(load, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      load();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>الكواكب والمحاكاة</h1>
      {message && <p style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>{message}</p>}
      {planets.map((p) => (
        <Panel key={p.id} title={p.name} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="seed" value={p.seed} />
            <Stat label="tick" value={p.currentTick} />
            <Stat label="السنة" value={p.currentTick * p.yearsPerTick} />
            <Stat label="الحقبة" value={p.era} />
            <Stat label="حضارات" value={p._count.civilizations} />
            <Stat label="أحداث" value={p._count.events.toLocaleString()} />
            <Stat label="الحالة" value={<Badge color={p.status === "running" ? "var(--planet-green)" : "var(--planet-orange)"}>{p.status}</Badge>} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button disabled={busy} onClick={() => act(() => api(`/worlds/${p.id}/ticks`, { method: "POST", body: { count: 10 } }), "+10 ticks")}>
              +10 نبضات
            </Button>
            <Button disabled={busy} onClick={() => act(() => api(`/worlds/${p.id}/ticks`, { method: "POST", body: { count: 100 } }), "+100 ticks")}>
              +100 نبضة
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                const tick = Number(prompt("الرجوع إلى tick رقم:", "0"));
                if (!Number.isNaN(tick)) {
                  void act(() => api(`/worlds/${p.id}/rollback`, { method: "POST", body: { tick } }), `rollback → ${tick}`);
                }
              }}
            >
              Rollback
            </Button>
          </div>
        </Panel>
      ))}
    </Shell>
  );
}
