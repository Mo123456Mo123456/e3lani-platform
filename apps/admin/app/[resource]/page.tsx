"use client";

import { use, useCallback, useEffect, useState } from "react";

import { Button, Card } from "@e3lani/ui";

import { AdminShell } from "@/components/admin-shell";
import { api } from "@/lib/api";

const resources = {
  users: { title: "المستخدمون", endpoint: "/admin/users" },
  reports: { title: "البلاغات", endpoint: "/admin/reports" },
  appeals: { title: "الاعتراضات", endpoint: "/admin/appeals" },
  prices: { title: "الأسعار", endpoint: "/admin/prices" },
  banners: { title: "شعارات الشريط", endpoint: "/admin/banners" },
  audit: { title: "سجل الإجراءات", endpoint: "/admin/audit" },
} as const;

type ResourceName = keyof typeof resources;
type Row = Record<string, unknown> & { id?: string; code?: string };

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: rawResource } = use(params);
  const resource = rawResource as ResourceName;
  const config = resources[resource];
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      setRows(await api<Row[]>(config.endpoint));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!config) {
    return (
      <AdminShell>
        <h1 className="text-2xl font-black">المسار غير موجود</h1>
      </AdminShell>
    );
  }

  async function decide(row: Row, action: string) {
    const reason = window.prompt("اكتب سبب القرار؛ سيُحفظ في سجل الإجراءات:");
    if (!reason?.trim()) return;
    try {
      if (resource === "reports") {
        await api(`/admin/reports/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action, reason, notifyOwner: true }),
        });
      } else if (resource === "appeals") {
        await api(`/admin/appeals/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ accepted: action === "ACCEPT", reason }),
        });
      } else if (resource === "banners") {
        await api(`/admin/banners/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action, reason }),
        });
      }
      await load();
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "تعذر حفظ القرار");
    }
  }

  async function savePrice(row: Row, form: HTMLFormElement) {
    const formData = new FormData(form);
    try {
      await api(`/admin/prices/${row.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          priceHalalas: Math.round(Number(formData.get("price")) * 100),
          durationDays: formData.get("duration")
            ? Number(formData.get("duration"))
            : undefined,
          enabled: formData.get("enabled") === "on",
        }),
      });
      await load();
    } catch (priceError) {
      setError(priceError instanceof Error ? priceError.message : "تعذر حفظ السعر");
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">{config.title}</h1>
        <Button variant="ghost" onClick={() => void load()}>
          تحديث
        </Button>
      </div>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {loading && <p className="mt-6">جارٍ تحميل البيانات…</p>}
      {!loading && !rows.length && (
        <Card className="mt-6 text-center text-zinc-600">لا توجد سجلات في هذه القائمة.</Card>
      )}
      <div className="mt-6 grid gap-4">
        {rows.map((row, index) => (
          <Card key={row.id ?? row.code ?? index}>
            <div className="grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(row)
                .filter(([key]) => !["id", "code"].includes(key))
                .slice(0, 12)
                .map(([key, value]) => (
                  <p key={key} className="min-w-0">
                    <span className="font-bold">{key}: </span>
                    <span className="break-words text-zinc-600">{display(value)}</span>
                  </p>
                ))}
            </div>
            {resource === "reports" && (
              <div className="mt-4 flex gap-2">
                <Button variant="danger" onClick={() => void decide(row, "SUSPEND")}>
                  إيقاف الإعلان
                </Button>
                <Button variant="ghost" onClick={() => void decide(row, "DISMISS")}>
                  رفض البلاغ
                </Button>
              </div>
            )}
            {resource === "appeals" && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void decide(row, "ACCEPT")}>قبول الاعتراض</Button>
                <Button variant="danger" onClick={() => void decide(row, "REJECT")}>
                  رفض الاعتراض
                </Button>
              </div>
            )}
            {resource === "banners" && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => void decide(row, "APPROVE")}>قبول</Button>
                <Button variant="danger" onClick={() => void decide(row, "REJECT")}>
                  رفض
                </Button>
                <Button variant="ghost" onClick={() => void decide(row, "PAUSE")}>
                  إيقاف
                </Button>
              </div>
            )}
            {resource === "prices" && (
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePrice(row, event.currentTarget);
                }}
              >
                <label>
                  <span className="block text-xs font-bold">السعر بالريال</span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(row.priceHalalas ?? 0) / 100}
                    className="mt-1 rounded-lg border px-3 py-2"
                  />
                </label>
                <label>
                  <span className="block text-xs font-bold">المدة بالأيام</span>
                  <input
                    name="duration"
                    type="number"
                    min="1"
                    defaultValue={display(row.durationDays) === "—" ? "" : display(row.durationDays)}
                    className="mt-1 rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input name="enabled" type="checkbox" defaultChecked={Boolean(row.enabled)} />
                  مفعّل
                </label>
                <Button type="submit">حفظ السعر</Button>
              </form>
            )}
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
