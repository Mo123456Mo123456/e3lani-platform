import { notFound } from "next/navigation";
import { WorldDashboard } from "@/components/layout/WorldDashboard";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <WorldDashboard locale={locale} dictionary={getDictionary(locale)} />;
}
