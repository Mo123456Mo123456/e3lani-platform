import { notFound } from "next/navigation";
import { InteriorPage } from "@/components/layout/InteriorPage";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <InteriorPage kind="profile" locale={locale} dictionary={getDictionary(locale)} />;
}
