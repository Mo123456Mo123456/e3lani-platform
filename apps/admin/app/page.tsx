"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeDollarSign,
  ChartNoAxesCombined,
  FileWarning,
  Image,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Users
} from "lucide-react";
import { Button, Card, Logo } from "@e3lani/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Section = "dashboard" | "users" | "ads" | "reports" | "prices" | "banners" | "audit";

const sections: Array<{ id: Section; label: string; icon: typeof Users }> = [
  { id: "dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "users", label: "المستخدمون", icon: Users },
  { id: "ads", label: "الإعلانات", icon: ListChecks },
  { id: "reports", label: "البلاغات والاعتراضات", icon: FileWarning },
  { id: "banners", label: "شعارات الشريط", icon: Image },
  { id: "prices", label: "الأسعار والمدفوعات", icon: BadgeDollarSign },
  { id: "audit", label: "سجل الإجراءات", icon: ScrollText }
];

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [phone, setPhone] = useState("+9665");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    const response = await fetch(`${api}/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone })
    });
    if (response.ok) setSent(true);
    else setError("تعذر إرسال رمز التحقق.");
  }

  async function verify() {
    const response = await fetch(`${api}/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, code })
    });
    const result = await response.json();
    if (!response.ok || !result.user?.staffRole) {
      setError("بيانات الدخول غير صالحة أو الحساب لا يملك صلاحية إدارية.");
      return;
    }
    sessionStorage.setItem("e3lani.adminToken", result.accessToken);
    onLogin(result.accessToken);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted p-4">
      <Card className="w-full max-w-sm p-6">
        <Logo />
        <h1 className="mt-5 text-2xl font-black">دخول فريق الإدارة</h1>
        <p className="mt-1 text-sm text-black/55">هذه اللوحة مخصصة للحسابات الإدارية المصرح بها.</p>
        <div className="mt-6 grid gap-3">
          <input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-xl border px-3 text-left" />
          {sent && <input dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 rounded-xl border px-3 text-center text-xl tracking-[0.4em]" placeholder="000000" />}
          <Button onClick={() => void (sent ? verify() : request())} disabled={sent ? code.length !== 6 : phone.length !== 13}>
            {sent ? "تحقق ودخول" : "إرسال رمز التحقق"}
          </Button>
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Card>
    </main>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [section, setSection] = useState<Section>("dashboard");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => setToken(sessionStorage.getItem("e3lani.adminToken") ?? ""), []);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    const response = await fetch(`${api}/admin/${section}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem("e3lani.adminToken");
      setToken("");
      return;
    }
    if (!response.ok) {
      setError("تعذر تحميل البيانات المطلوبة.");
      return;
    }
    setData(await response.json());
  }, [section, token]);

  useEffect(() => void load(), [load]);

  async function reportAction(id: string, action: string) {
    const reason = window.prompt("اكتب سبب القرار ليظهر في السجل والإشعار:");
    if (!reason) return;
    await fetch(`${api}/admin/reports/${id}/action`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ action, reason })
    });
    await load();
  }

  async function updatePrice(code: string, current: number, active: boolean) {
    const value = window.prompt("السعر الجديد بالهللات:", String(current));
    if (!value || !Number.isInteger(Number(value))) return;
    await fetch(`${api}/admin/prices/${code}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ amountHalalas: Number(value), active })
    });
    await load();
  }

  async function reviewBanner(id: string, approved: boolean) {
    const reason = approved ? undefined : window.prompt("سبب الرفض:");
    if (!approved && !reason) return;
    await fetch(`${api}/admin/banners/${id}/review`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ approved, reason })
    });
    await load();
  }

  if (!token) return <AdminLogin onLogin={setToken} />;

  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="min-h-dvh bg-muted md:grid md:grid-cols-[260px_1fr]">
      <aside className="border-l bg-white p-4">
        <Logo />
        <nav className="mt-7 grid grid-cols-2 gap-2 md:grid-cols-1">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setSection(item.id)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-right text-sm font-bold ${section === item.id ? "bg-brand" : "hover:bg-muted"}`}>
                <Icon size={18} />{item.label}
              </button>
            );
          })}
        </nav>
        <Button variant="outline" className="mt-6 w-full" onClick={() => { sessionStorage.removeItem("e3lani.adminToken"); setToken(""); }}>تسجيل الخروج</Button>
      </aside>
      <main className="p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-black/50">لوحة الإدارة</p><h1 className="text-3xl font-black">{sections.find((item) => item.id === section)?.label}</h1></div>
          <ChartNoAxesCombined className="text-black/25" size={34} />
        </div>
        {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {section === "dashboard" && data && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Object.entries(data).map(([key, value]) => <Card key={key} className="p-4"><p className="text-xs text-black/50">{key}</p><strong className="mt-2 block text-2xl">{String(value)}</strong></Card>)}
          </div>
        )}
        {section !== "dashboard" && (
          <div className="mt-6 grid gap-3">
            {!rows.length && <Card className="p-8 text-center text-black/50">لا توجد سجلات في هذا القسم.</Card>}
            {rows.map((row: any) => (
              <Card key={row.id ?? row.code} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{row.name ?? row.title ?? row.code ?? row.action ?? row.reason}</strong>
                    <p className="mt-1 text-sm text-black/55">{row.phone ?? row.status ?? row.nameAr ?? row.entityType}</p>
                    {row.actionReason && <p className="mt-2 text-sm">{row.actionReason}</p>}
                  </div>
                  {section === "reports" && row.status !== "DISMISSED" && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => void reportAction(row.id, "DISMISS")}>رفض البلاغ</Button>
                      <Button variant="danger" onClick={() => void reportAction(row.id, "PAUSE")}>إيقاف الإعلان</Button>
                    </div>
                  )}
                  {section === "prices" && (
                    <Button variant="outline" onClick={() => void updatePrice(row.code, row.amountHalalas, row.active)}>
                      {(row.amountHalalas / 100).toLocaleString("ar-SA")} ر.س · تعديل
                    </Button>
                  )}
                  {section === "banners" && row.status === "AWAITING_REVIEW" && (
                    <div className="flex gap-2">
                      <Button onClick={() => void reviewBanner(row.id, true)}>قبول</Button>
                      <Button variant="danger" onClick={() => void reviewBanner(row.id, false)}>رفض</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
