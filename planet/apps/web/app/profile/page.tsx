"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { DataPage } from "@/components/DataPage";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Badge, Panel, Stat, Button } from "@planet/ui";

interface Me {
  id: string;
  email: string;
  role: string;
  profile?: { displayName: string; impactScore: number; locale: string } | null;
  contributions: { id: string; category: string; status: string; impactScore: number; eventCount: number; appliedTick: number | null; createdAt: string }[];
  createdAt: string;
}

export default function ProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: me } = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => api<Me>("/users/me", { auth: true }),
    enabled: !!user,
  });

  if (!user) {
    return (
      <DataPage title={t.pages.notifications}>
        <Panel>
          <p style={{ fontSize: 13 }}>{t.auth.login}</p>
          <Button onClick={() => router.push("/login")}>{t.auth.login}</Button>
        </Panel>
      </DataPage>
    );
  }

  return (
    <DataPage title={t.profile.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <Stat label={t.auth.displayName} value={me?.profile?.displayName ?? user.displayName ?? "—"} />
            <Stat label={t.profile.role} value={<Badge color="var(--planet-accent)">{me?.role ?? user.role}</Badge>} />
            <Stat label={t.profile.impactScore} value={Math.round((me?.profile?.impactScore ?? 0) * 10) / 10} color="var(--planet-gold)" />
            <Stat label={t.profile.joinedAt} value={me ? new Date(me.createdAt).toLocaleDateString() : "—"} />
          </div>
        </Panel>

        <Panel title={t.profile.myContributions}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(me?.contributions ?? []).map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--planet-border)" }}>
                <span>{t.categories[c.category as keyof typeof t.categories] ?? c.category}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <Badge>{c.status}</Badge>
                  <Badge color="var(--planet-accent)">{c.eventCount} events</Badge>
                  <Badge color="var(--planet-gold)">impact {Math.round(c.impactScore * 10) / 10}</Badge>
                </span>
              </div>
            ))}
            {(me?.contributions ?? []).length === 0 && <p style={{ fontSize: 12, color: "var(--planet-text-dim)" }}>{t.common.noData}</p>}
          </div>
        </Panel>
      </div>
    </DataPage>
  );
}
