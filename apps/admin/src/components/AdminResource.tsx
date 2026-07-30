"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";

export type ResourceKind = "users" | "planets" | "contributions" | "ai-costs" | "audit-log";
type Row = Record<string, unknown> & { id?: string };

const config: Record<ResourceKind, { title: string; subtitle: string; endpoint: string; columns: [string, string][] }> = {
  users: {
    title: "المستخدمون",
    subtitle: "إدارة الحسابات والأدوار وحالة الوصول",
    endpoint: "/admin/users",
    columns: [["name", "المستخدم"], ["email", "البريد"], ["role", "الدور"], ["status", "الحالة"], ["createdAt", "تاريخ الانضمام"]],
  },
  planets: {
    title: "الكواكب والمحاكاة",
    subtitle: "مراقبة دورات المحاكاة والتحكم الآمن بها",
    endpoint: "/admin/planets",
    columns: [["name", "الكوكب"], ["seed", "البذرة"], ["status", "الحالة"], ["tick", "الدورة"], ["population", "السكان"]],
  },
  contributions: {
    title: "مراجعة المساهمات",
    subtitle: "تحقق من الأثر قبل إدخاله إلى سجل العالم",
    endpoint: "/admin/contributions",
    columns: [["title", "الفكرة"], ["author", "المساهم"], ["category", "الفئة"], ["risk", "المخاطر"], ["status", "الحالة"]],
  },
  "ai-costs": {
    title: "تكاليف الذكاء الاصطناعي",
    subtitle: "واجهات القياس جاهزة لبيانات مزودي النماذج",
    endpoint: "/admin/ai-costs",
    columns: [["model", "النموذج"], ["requests", "الطلبات"], ["tokens", "الرموز"], ["cost", "التكلفة"], ["period", "الفترة"]],
  },
  "audit-log": {
    title: "سجل التدقيق",
    subtitle: "أثر غير قابل للتعديل لكل عملية إدارية",
    endpoint: "/admin/audit-logs",
    columns: [["actor", "المنفذ"], ["action", "العملية"], ["target", "الهدف"], ["ip", "عنوان IP"], ["createdAt", "الوقت"]],
  },
};

const fallbacks: Record<ResourceKind, Row[]> = {
  users: [
    { id: "u1", name: "ليان السعد", email: "layan@example.com", role: "creator", status: "active", createdAt: "اليوم" },
    { id: "u2", name: "عمر نديم", email: "omar@example.com", role: "observer", status: "active", createdAt: "أمس" },
    { id: "u3", name: "نور أحمد", email: "nour@example.com", role: "moderator", status: "review", createdAt: "28 يوليو" },
  ],
  planets: [
    { id: "k07", name: "K-07 / أوريان", seed: "1847-AF", status: "running", tick: "8,420", population: "8.42M" },
    { id: "v12", name: "V-12 / نوفا", seed: "9201-XQ", status: "paused", tick: "3,118", population: "2.17M" },
  ],
  contributions: [
    { id: "c1", title: "غابة قادرة على تخزين الذاكرة", author: "ليان", category: "طبيعة", risk: "متوسط", status: "pending" },
    { id: "c2", title: "شبكة نقل بالطاقة المدّية", author: "عمر", category: "تقنية", risk: "منخفض", status: "pending" },
  ],
  "ai-costs": [
    { id: "a1", model: "World Analyzer", requests: "—", tokens: "—", cost: "قيد الربط", period: "هذا الشهر" },
    { id: "a2", model: "Event Narrator", requests: "—", tokens: "—", cost: "قيد الربط", period: "هذا الشهر" },
  ],
  "audit-log": [
    { id: "l1", actor: "system_admin", action: "PLANET_TICK", target: "K-07", ip: "10.0.0.24", createdAt: "22:07:18" },
    { id: "l2", actor: "super_admin", action: "CONTRIBUTION_REVIEW", target: "c-1284", ip: "10.0.0.11", createdAt: "21:55:04" },
  ],
};

function display(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AdminResource({ kind }: { kind: ResourceKind }) {
  const details = config[kind];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [actionId, setActionId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi<Row[] | { data?: Row[]; items?: Row[] }>(details.endpoint);
      const nextRows = Array.isArray(result) ? result : result.data ?? result.items ?? [];
      setRows(nextRows);
      setOffline(false);
    } catch {
      setRows(fallbacks[kind]);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [details.endpoint, kind]);

  useEffect(() => { void load(); }, [load]);

  async function perform(row: Row, action: string) {
    if (!row.id) return;
    setActionId(`${row.id}-${action}`);
    try {
      await adminApi(`${details.endpoint}/${row.id}/${action}`, { method: "POST" });
      await load();
    } catch {
      setOffline(true);
    } finally {
      setActionId("");
    }
  }

  return (
    <main className="admin-content">
      <header className="page-heading">
        <div><span>ADMIN / {kind.toUpperCase()}</span><h1>{details.title}</h1><p>{details.subtitle}</p></div>
        <button onClick={() => void load()}>↻ تحديث البيانات</button>
      </header>
      {offline && <div className="offline-banner"><i /> تعذر الوصول إلى API — تُعرض بيانات توضيحية آمنة</div>}
      <section className="admin-panel table-panel">
        <div className="table-toolbar">
          <label>⌕ <input placeholder="بحث وتصفية…" /></label>
          <span>{loading ? "جارٍ التحميل…" : `${rows.length} سجل`}</span>
        </div>
        <div className="resource-table-wrap">
          <table>
            <thead><tr>{details.columns.map(([, label]) => <th key={label}>{label}</th>)}{(kind === "planets" || kind === "contributions") && <th>الإجراءات</th>}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id ?? index}>
                  {details.columns.map(([key]) => <td key={key}><span className={`value-${key}`}>{display(row[key])}</span></td>)}
                  {kind === "planets" && (
                    <td className="row-actions">
                      <button disabled={!!actionId} onClick={() => void perform(row, row.status === "paused" ? "resume" : "pause")}>{row.status === "paused" ? "استئناف" : "إيقاف"}</button>
                      <button disabled={!!actionId} onClick={() => void perform(row, "tick")}>Tick +1</button>
                    </td>
                  )}
                  {kind === "contributions" && (
                    <td className="row-actions">
                      <button className="approve" disabled={!!actionId} onClick={() => void perform(row, "approve")}>قبول</button>
                      <button className="reject" disabled={!!actionId} onClick={() => void perform(row, "reject")}>رفض</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
