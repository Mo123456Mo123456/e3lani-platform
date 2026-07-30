import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AuthForm mode="register" locale={locale} dictionary={getDictionary(locale)} />;
}
