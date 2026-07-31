import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/i18n";
import { Providers } from "@/components/Providers";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Providers locale={locale}>{children}</Providers>;
}
