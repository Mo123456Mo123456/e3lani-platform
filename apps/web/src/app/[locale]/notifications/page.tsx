"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Panel, Spinner } from "@kawkab/ui";
import type { NotificationItem } from "@kawkab/shared-types";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { useT } from "@/components/LocaleProvider";

export default function NotificationsPage() {
  const { t, locale } = useT();
  const user = useWorldStore((s) => s.user);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: NotificationItem[]; unreadCount: number }>("/api/notifications"),
    enabled: !!user,
    refetchInterval: 20_000,
  });

  const markAll = async () => {
    await api("/api/notifications/read-all", { method: "PATCH" });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto mt-16 px-4">
        <Panel title={t("notifications.title")}>
          <div className="text-dim text-sm">{t("contribute.loginRequired")}</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Panel title={t("notifications.title")} actions={data && data.unreadCount > 0 ? <Button variant="ghost" onClick={markAll}>{t("notifications.markAll")}</Button> : null}>
        {isLoading ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <div className="text-dim text-sm">{t("notifications.empty")}</div>
        ) : (
          <div className="space-y-2">
            {data.items.map((n) => (
              <div key={n.id} className={`rounded border p-3 ${n.read ? "border-line opacity-70" : "border-tech/50 bg-tech/5"}`}>
                <div className="text-sm font-semibold">{locale === "en" && typeof n.data.titleEn === "string" ? n.data.titleEn : n.title}</div>
                <div className="text-xs text-dim mt-0.5">{n.body}</div>
                <div className="text-[10px] text-dim/60 mt-1 tabular-nums" dir="ltr">{new Date(n.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
