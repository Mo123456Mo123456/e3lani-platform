"use client";

import React, { useEffect, useState } from "react";
import { Panel, Stat, Badge } from "@planet/ui";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface Overview {
  users: number;
  planets: number;
  contributions: number;
  events: number;
  aiRequests: number;
  aiCostUsd: number;
  moderationBlocks: number;
  realtimeConnections: number;
}

interface ServiceHealth {
  engine: boolean;
  orchestrator: boolean;
  realtimeConnections: number;
}

export default function AdminHome() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Overview>("/admin/overview"),
      api<ServiceHealth>("/admin/services/health"),
    ])
      .then(([o, h]) => {
        setOverview(o);
        setHealth(h);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <Shell>
      <h1 style={{ fontSize: 20, color: "var(--planet-accent)" }}>نظرة عامة</h1>
      {error && <p style={{ color: "var(--planet-red)" }}>{error}</p>}
      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          <Panel><Stat label="مستخدمون" value={overview.users} /></Panel>
          <Panel><Stat label="كواكب" value={overview.planets} /></Panel>
          <Panel><Stat label="إضافات" value={overview.contributions} /></Panel>
          <Panel><Stat label="أحداث العالم" value={overview.events.toLocaleString()} /></Panel>
          <Panel><Stat label="طلبات AI" value={overview.aiRequests} /></Panel>
          <Panel><Stat label="تكلفة AI ($)" value={overview.aiCostUsd.toFixed(4)} /></Panel>
          <Panel><Stat label="حظر إشراف" value={overview.moderationBlocks} color="var(--planet-orange)" /></Panel>
          <Panel><Stat label="اتصالات حية" value={overview.realtimeConnections} color="var(--planet-green)" /></Panel>
        </div>
      )}
      {health && (
        <Panel title="صحة الخدمات">
          <div style={{ display: "flex", gap: 10 }}>
            <Badge color={health.engine ? "var(--planet-green)" : "var(--planet-red)"}>
              engine {health.engine ? "up" : "down"}
            </Badge>
            <Badge color={health.orchestrator ? "var(--planet-green)" : "var(--planet-red)"}>
              orchestrator {health.orchestrator ? "up" : "down"}
            </Badge>
          </div>
        </Panel>
      )}
    </Shell>
  );
}
