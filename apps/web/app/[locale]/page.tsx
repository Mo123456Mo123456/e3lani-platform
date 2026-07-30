import type { Metadata } from "next";
import Link from "next/link";

import { LogoTicker } from "@/components/logo-ticker";
import { VisualFeed } from "@/components/visual-feed";
import { getCatalog, getFeed, getTicker } from "@/lib/api";

export const metadata: Metadata = {
  alternates: { canonical: "/ar", languages: { ar: "/ar", en: "/en" } },
};

export default async function LocaleHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "ar" | "en" }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const ar = locale === "ar";
  const mode = ["FOR_YOU", "NEARBY", "LATEST"].includes(query.mode ?? "")
    ? query.mode
    : "FOR_YOU";
  const [feed, catalog, ticker] = await Promise.all([
    getFeed({ ...query, mode }),
    getCatalog(),
    getTicker(),
  ]);

  return (
    <main>
      <LogoTicker logos={ticker} label={ar ? "شعارات معلني الشريط" : "Advertiser ticker logos"} />
      <form
        action={`/${locale}`}
        className="border-b border-black/10 bg-e3-gray px-4 py-3"
        aria-label={ar ? "بحث وفلاتر الإعلانات" : "Ad search and filters"}
      >
        <div className="mx-auto grid max-w-6xl gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input
            name="search"
            defaultValue={query.search}
            placeholder={ar ? "ابحث في الإعلانات" : "Search ads"}
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-e3-yellow lg:col-span-2"
          />
          <select name="cityId" defaultValue={query.cityId ?? ""} className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm">
            <option value="">{ar ? "كل المدن" : "All cities"}</option>
            {catalog.regions.flatMap((region) =>
              region.cities.map((city) => (
                <option key={city.id} value={city.id}>{ar ? city.nameAr : city.nameEn}</option>
              )),
            )}
          </select>
          <select name="categoryId" defaultValue={query.categoryId ?? ""} className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm">
            <option value="">{ar ? "كل الأقسام" : "All categories"}</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>{ar ? category.nameAr : category.nameEn}</option>
            ))}
          </select>
          <select name="media" defaultValue={query.media ?? ""} className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm">
            <option value="">{ar ? "كل الوسائط" : "All media"}</option>
            <option value="IMAGE">{ar ? "صور فقط" : "Images only"}</option>
            <option value="VIDEO">{ar ? "فيديو فقط" : "Video only"}</option>
          </select>
          <button className="h-11 rounded-xl bg-e3-black px-5 text-sm font-black text-white">
            {ar ? "تطبيق الفلاتر" : "Apply filters"}
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-6xl flex-wrap gap-4 text-xs font-bold">
          {([
            ["verified", ar ? "حسابات موثقة" : "Verified"],
            ["featured", ar ? "مميزة" : "Featured"],
            ["sponsored", ar ? "مموّلة" : "Sponsored"],
          ] as const).map(([name, label]) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" name={name} value="true" defaultChecked={query[name] === "true"} />
              {label}
            </label>
          ))}
        </div>
      </form>
      <section className="border-b border-black/10 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-xl gap-2">
          {[
            ["FOR_YOU", ar ? "لك" : "For you"],
            ["NEARBY", ar ? "قريب منك" : "Nearby"],
            ["LATEST", ar ? "الأحدث" : "Latest"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/${locale}?mode=${value}${query.cityId ? `&cityId=${query.cityId}` : ""}`}
              className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold ${
                mode === value ? "bg-e3-yellow" : "bg-e3-gray"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
      <VisualFeed items={feed.items} locale={locale} />

      <section id="categories" className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">{ar ? "تصفّح الأقسام" : "Browse categories"}</h2>
            <p className="mt-2 text-black/55">
              {ar ? "كل شيء في مكان واحد، والتواصل مباشرة مع المعلن." : "Everything in one place, with direct advertiser contact."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {catalog.categories.map((category) => (
            <Link
              key={category.id}
              href={`/${locale}?categoryId=${category.id}`}
              className="rounded-2xl border border-black/10 bg-white p-5 font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-e3-yellow"
            >
              {ar ? category.nameAr : category.nameEn}
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/10 bg-white px-4 py-8 text-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="font-bold">© {new Date().getFullYear()} إعلاني | E3lani</p>
          <nav className="flex gap-4">
            <Link href={`/${locale}/privacy`}>{ar ? "الخصوصية" : "Privacy"}</Link>
            <Link href={`/${locale}/terms`}>{ar ? "الشروط" : "Terms"}</Link>
            <Link href={`/${locale}/safety`}>{ar ? "السلامة" : "Safety"}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
