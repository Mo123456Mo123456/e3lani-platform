import { notFound } from "next/navigation";
import { InteriorPage } from "@/components/layout/InteriorPage";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function TimelinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <InteriorPage kind="timeline" locale={locale} dictionary={getDictionary(locale)} />;
}
