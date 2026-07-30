import { Card } from "@e3lani/ui";

import { adminApi } from "@/lib/api";

export default async function DashboardPage() {
  const data = await adminApi<{
    users: number;
    activeAds: number;
    profilePosts: number;
    openReports: number;
    pendingTicker: number;
    capturedRevenueHalalas: number;
  }>("overview");
  const cards = [
    ["المستخدمون النشطون", data.users],
    ["الإعلانات النشطة", data.activeAds],
    ["المنشورات المجانية", data.profilePosts],
    ["البلاغات المفتوحة", data.openReports],
    ["طلبات الشريط", data.pendingTicker],
    ["المدفوعات المحصلة", `${(data.capturedRevenueHalalas / 100).toLocaleString("ar-SA")} ر.س`],
  ];
  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-black">نظرة عامة</h1>
        <p className="mt-2 text-sm text-black/55">بيانات مباشرة من قاعدة المنصة المركزية.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm font-bold text-black/50">{label}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
