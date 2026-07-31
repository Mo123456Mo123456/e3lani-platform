"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { DataPage } from "@/components/DataPage";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuthStore, useUiStore } from "@/lib/store";
import { Badge, Panel, Button } from "@planet/ui";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  eventSeq?: number;
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const live = useUiStore((s) => s.notifications);

  const { data, refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api<NotificationRow[]>("/notifications", { auth: true }),
    enabled: !!user,
  });

  const markAll = async () => {
    await api("/notifications/read-all", { method: "POST", auth: true });
    await refetch();
  };

  return (
    <DataPage title={t.pages.notifications}>
      <Panel
        title={t.pages.notifications}
        right={user && <Button variant="ghost" onClick={markAll}>✓</Button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {live.map((n) => (
            <div key={`live-${n.id}`} style={{ fontSize: 12, padding: 8, border: "1px solid var(--planet-accent)", borderRadius: 8 }}>
              <Badge color="var(--planet-accent)">live</Badge> {n.title}
            </div>
          ))}
          {(data ?? []).map((n) => (
            <div
              key={n.id}
              style={{
                fontSize: 12, padding: 8, borderRadius: 8,
                border: `1px solid ${n.read ? "var(--planet-border)" : "var(--planet-accent)"}`,
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              <div style={{ color: "var(--planet-text-dim)", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: "var(--planet-text-dim)", marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          {!user && <p style={{ fontSize: 13, color: "var(--planet-text-dim)" }}>{t.auth.login}</p>}
          {user && (data ?? []).length === 0 && live.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>{t.common.noData}</p>
          )}
        </div>
      </Panel>
    </DataPage>
  );
}
