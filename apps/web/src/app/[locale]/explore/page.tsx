import { notFound } from "next/navigation";
import { InteriorPage } from "@/components/layout/InteriorPage";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <InteriorPage kind="explore" locale={locale} dictionary={getDictionary(locale)} />;
}
