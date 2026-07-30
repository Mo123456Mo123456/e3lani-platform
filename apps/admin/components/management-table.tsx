"use client";

import { Button, Card, Input } from "@e3lani/ui";
import { useState } from "react";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return JSON.stringify(value);
}

async function mutate(path: string, body: object) {
  const response = await fetch(`/api/admin/${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("REQUEST_FAILED");
  return response.json();
}

function RowActions({ section, row }: { section: string; row: Row }) {
  const [busy, setBusy] = useState(false);
  const id = String(row.id);

  async function act(path: string, payload: object) {
    const reason = window.prompt("اكتب سبب الإجراء لتسجيله في سجل التدقيق:");
    if (!reason || reason.trim().length < 5) return;
    setBusy(true);
    try {
      await mutate(path, { ...payload, reason });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  if (section === "users") {
    const suspended = row.status === "SUSPENDED";
    return (
      <Button
        size="sm"
        variant={suspended ? "primary" : "danger"}
        disabled={busy}
        onClick={() => act(`users/${id}/status`, { status: suspended ? "ACTIVE" : "SUSPENDED" })}
      >
        {suspended ? "إعادة تفعيل" : "إيقاف"}
      </Button>
    );
  }
  if (section === "reports") {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(`reports/${id}`, { action: "DISMISS" })}>
          استبعاد
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => act(`reports/${id}`, { action: "PAUSE" })}>
          إيقاف الإعلان
        </Button>
        <Button size="sm" variant="dark" disabled={busy} onClick={() => act(`reports/${id}`, { action: "REMOVE" })}>
          حذف
        </Button>
        <Button size="sm" disabled={busy} onClick={() => act(`reports/${id}`, { action: "REACTIVATE" })}>
          إعادة تفعيل
        </Button>
      </div>
    );
  }
  if (section === "ticker") {
    return (
      <div className="flex flex-wrap gap-1">
        {(["APPROVED", "ACTIVE", "REJECTED", "PAUSED"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "REJECTED" ? "danger" : "outline"}
            disabled={busy}
            onClick={() => act(`ticker/${id}`, { status })}
          >
            {status}
          </Button>
        ))}
      </div>
    );
  }
  return null;
}

function PricingEditor({ versions }: { versions: Row[] }) {
  const active = versions.find((version) => version.active === true);
  const rules = Array.isArray(active?.rules) ? (active.rules as Row[]) : [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rules.map((rule) => (
        <Card key={String(rule.id)}>
          <p className="font-black">{text(rule.nameAr)}</p>
          <p className="mt-1 text-xs text-black/50">{text(rule.code)}</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const reason = window.prompt("سبب تعديل السعر:");
              if (!reason || reason.length < 5) return;
              await mutate(`pricing/${rule.id}`, {
                priceHalalas: Math.round(Number(form.get("price")) * 100),
                durationDays: rule.durationDays,
                reason,
              });
              window.location.reload();
            }}
          >
            <Input name="price" type="number" min="0" step="0.01" defaultValue={Number(rule.priceHalalas) / 100} />
            <Button size="sm">حفظ ر.س</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}

function SettingsEditor({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <Card key={String(row.key)} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-black">{text(row.key)}</p>
            <p className="text-sm text-black/50">{text(row.description)}</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const raw = String(form.get("value"));
              const value = raw === "true" ? true : raw === "false" ? false : /^\d+$/.test(raw) ? Number(raw) : raw;
              const reason = window.prompt("سبب تعديل الإعداد:");
              if (!reason || reason.length < 5) return;
              await mutate(`settings/${encodeURIComponent(String(row.key))}`, { value, reason });
              window.location.reload();
            }}
          >
            <Input name="value" defaultValue={text(row.value)} className="w-56" />
            <Button size="sm">حفظ</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}

export function ManagementTable({ section, data }: { section: string; data: unknown }) {
  const rows = Array.isArray(data) ? (data as Row[]) : [data as Row];
  if (section === "pricing") return <PricingEditor versions={rows} />;
  if (section === "settings") return <SettingsEditor rows={rows} />;
  if (rows.length === 0) {
    return <Card className="text-center text-black/55">لا توجد سجلات مطابقة.</Card>;
  }
  const preferredColumns: Record<string, string[]> = {
    users: ["id", "phone", "email", "status", "profile", "roles", "createdAt"],
    reports: ["id", "reason", "details", "status", "distribution", "createdAt"],
    ticker: ["id", "status", "owner", "startsAt", "expiresAt", "reason"],
    payments: ["id", "provider", "status", "amountHalalas", "providerRef", "createdAt"],
    audit: ["createdAt", "action", "entityType", "entityId", "actor", "reason"],
    analytics: ["users", "activeAds", "profilePosts", "openReports", "capturedRevenueHalalas"],
  };
  const columns = preferredColumns[section] ?? Object.keys(rows[0] ?? {}).slice(0, 7);
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
      <table className="w-full min-w-[800px] text-right text-sm">
        <thead className="bg-e3-black text-white">
          <tr>
            {columns.map((column) => <th key={column} className="p-3">{column}</th>)}
            {["users", "reports", "ticker"].includes(section) ? <th className="p-3">الإجراءات</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-t border-black/10 align-top">
              {columns.map((column) => (
                <td key={column} className="max-w-xs break-words p-3 text-xs">
                  {text(row[column])}
                </td>
              ))}
              {["users", "reports", "ticker"].includes(section) ? (
                <td className="p-3"><RowActions section={section} row={row} /></td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
