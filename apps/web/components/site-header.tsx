import Link from "next/link";

export function SiteHeader({ locale }: { locale: "ar" | "en" }) {
  const ar = locale === "ar";
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={`/${locale}`} className="flex items-baseline gap-2" aria-label={ar ? "إعلاني الرئيسية" : "E3lani home"}>
          <span className="text-2xl font-black">إعلاني</span>
          <span className="rounded-md bg-e3-yellow px-1.5 py-0.5 text-xs font-black">E3</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-bold" aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}>
          <Link href={`/${locale}#feed`}>{ar ? "الإعلانات" : "Ads"}</Link>
          <Link href={`/${locale}#categories`}>{ar ? "الأقسام" : "Categories"}</Link>
          <Link
            href={`/${ar ? "en" : "ar"}`}
            hrefLang={ar ? "en" : "ar"}
            className="rounded-lg border border-black/15 px-3 py-2"
          >
            {ar ? "English" : "العربية"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
