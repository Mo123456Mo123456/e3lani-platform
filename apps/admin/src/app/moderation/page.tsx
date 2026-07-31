"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, Empty, useToast } from "@planet/ui";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: queue } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: () => api().adminModerationQueue(),
  });

  async function review(id: string, decision: "approve" | "reject") {
    await api().adminModerationReview(id, decision);
    await queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    toast.push(decision === "approve" ? "اعتُمد" : "رُفض", decision === "approve" ? "nature" : "danger");
  }

  return (
    <AdminShell>
      <div className="admin-title">طابور الإشراف ({queue?.length ?? 0})</div>
      {!(queue ?? []).length ? (
        <Empty>لا عناصر معلّقة.</Empty>
      ) : (
        (queue ?? []).map((item) => (
          <Card key={item.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <Badge tone="warning">{item.status}</Badge>{" "}
                <span className="pb-dim" style={{ fontSize: 12 }} dir="ltr">{item.userEmail}</span>
                <div style={{ marginTop: 6, fontSize: 13 }}>{item.text}</div>
                <div className="pb-faint" style={{ fontSize: 11, marginTop: 4 }}>
                  {item.reasons.join("، ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Button size="sm" variant="nature" onClick={() => review(item.id, "approve")}>اعتماد</Button>
                <Button size="sm" variant="danger" onClick={() => review(item.id, "reject")}>رفض</Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </AdminShell>
  );
}
