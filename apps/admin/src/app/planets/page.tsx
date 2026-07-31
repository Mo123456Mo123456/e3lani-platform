"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Card, useToast } from "@planet/ui";
import { api } from "@/lib/client";
import { AdminShell } from "@/components/Shell";

export default function PlanetsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [ticks, setTicks] = useState(5);
  const [busy, setBusy] = useState(false);
  const { data: planet } = useQuery({
    queryKey: ["planet-current"],
    queryFn: () => api().getPlanet(),
    refetchInterval: 10_000,
  });
  const { data: snapshots } = useQuery({
    queryKey: ["snapshots", planet?.id],
    queryFn: () => api().getSnapshots(planet!.id),
    enabled: Boolean(planet),
  });

  async function control(action: string, payload: Record<string, unknown> = {}) {
    if (!planet) return;
    setBusy(true);
    try {
      await api().adminSimControl(planet.id, { action, ...payload });
      await queryClient.invalidateQueries({ queryKey: ["planet-current"] });
      toast.push(`تم: ${action}`, "nature");
    } catch (err) {
      toast.push(`فشل: ${(err as Error).message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function renderMaps() {
    if (!planet) return;
    setBusy(true);
    try {
      await api().post(`/admin/planets/${planet.id}/maps/render`);
      toast.push("أُعيد توليد الخرائط", "nature");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <div className="admin-title">الكواكب والمحاكاة</div>
      {planet ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: 17 }}>{planet.name}</strong>
              <Badge tone={planet.status === "running" ? "nature" : "warning"}>{planet.status}</Badge>
              <span className="pb-dim">seed: {planet.seed}</span>
              <span className="pb-mono">tick: {planet.tick}</span>
              <span className="pb-dim">hash: {planet.stateHash?.slice(0, 10)}…</span>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 13 }} className="pb-dim">
              <span>حضارات: {planet.civilizations}</span>
              <span>مدن: {planet.cities}</span>
              <span>أنواع: {planet.species}</span>
              <span>نباتات: {planet.plants}</span>
              <span>تقنيات: {planet.technologies}</span>
              <span>أحداث: {planet.eventCount}</span>
              <span>انحراف حراري: {planet.globalTempShift.toFixed(1)}°</span>
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <strong>التحكم بالمحاكاة</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button size="sm" variant="nature" disabled={busy} onClick={() => control("resume")}>تشغيل ▶</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => control("pause")}>إيقاف ⏸</Button>
              <input
                type="number"
                className="pb-input"
                style={{ width: 90 }}
                value={ticks}
                min={1}
                max={500}
                onChange={(e) => setTicks(Number(e.target.value))}
              />
              <Button size="sm" disabled={busy} onClick={() => control("tick", { ticks })}>
                تقديم {ticks} ⏩
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={renderMaps}>
                إعادة توليد الخرائط
              </Button>
            </div>
          </Card>

          <Card>
            <strong>Rollback إلى Snapshot</strong>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="pb-table">
                <thead>
                  <tr><th>tick</th><th>حضارات</th><th>مدن</th><th>أنواع</th><th>سكان</th><th>hash</th><th /></tr>
                </thead>
                <tbody>
                  {(snapshots ?? []).map((s) => (
                    <tr key={s.tick}>
                      <td className="pb-mono">{s.tick}</td>
                      <td>{s.summary.civilizations}</td>
                      <td>{s.summary.cities}</td>
                      <td>{s.summary.species}</td>
                      <td>{s.summary.population.toLocaleString()}</td>
                      <td className="pb-mono">{s.stateHash.slice(0, 8)}…</td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Rollback إلى السنة ${s.tick}؟ يُحذف التاريخ اللاحق.`)) {
                              control("rollback", { tick: s.tick });
                            }
                          }}
                        >
                          استرجاع
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>لا يوجد كوكب — نفّذ db:seed.</Card>
      )}
    </AdminShell>
  );
}
