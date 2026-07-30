import { notFound } from "next/navigation";

import { ManagementTable } from "@/components/management-table";
import { adminApi } from "@/lib/api";

const sections = {
  users: ["المستخدمون والحسابات التجارية", "users"],
  reports: ["البلاغات والاعتراضات", "reports"],
  pricing: ["الأسعار القابلة للتعديل", "pricing"],
  ticker: ["طلبات شعارات الشريط", "ticker"],
  payments: ["المدفوعات", "payments"],
  analytics: ["تحليلات المنصة", "overview"],
  settings: ["إعدادات التشغيل", "settings"],
  audit: ["سجل الإجراءات", "audit"],
} as const;

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const [title, endpoint] = sections[section as keyof typeof sections];
  const data = await adminApi<unknown>(endpoint);
  return (
    <>
      <div className="mb-7">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-black/55">كل إجراء إداري حساس يتطلب سببًا ويُسجل في سجل التدقيق.</p>
      </div>
      <ManagementTable section={section} data={data} />
    </>
  );
}
