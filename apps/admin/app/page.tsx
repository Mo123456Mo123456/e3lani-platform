"use client";

import { useEffect, useState } from "react";

import { Card } from "@e3lani/ui";

import { AdminShell } from "@/components/admin-shell";
import { api } from "@/lib/api";

type Dashboard = {
  users: number;
  activeAds: number;
  openReports: number;
  openAppeals: number;
  pendingBanners: number;
  paidRevenueHalalas: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Dashboard>("/admin/dashboard").then(setData).catch((reason: Error) => setError(reason.message));
  }, []);

  const metrics = data
    ? [
        ["المستخدمون النشطون", data.users],
        ["الإعلانات النشطة", data.activeAds],
        ["البلاغات المفتوحة", data.openReports],
        ["الاعتراضات المفتوحة", data.openAppeals],
        ["طلبات الشريط", data.pendingBanners],
        ["الإيراد المدفوع", `${(data.paidRevenueHalalas / 100).toFixed(2)} ر.س`],
      ]
    : [];

  return (
    <AdminShell>
      <h1 className="text-3xl font-black">نظرة عامة</h1>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {!data && !error && <p className="mt-6">جارٍ تحميل البيانات…</p>}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
