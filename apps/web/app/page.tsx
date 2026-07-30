import Link from "next/link";

import { AdFeed } from "@/components/ad-feed";
import { LogoStrip } from "@/components/logo-strip";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${api}/api/v1${path}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    cityId?: string;
    categoryId?: string;
    subcategoryId?: string;
  }>;
}) {
  const params = await searchParams;
  const mode = ["FOR_YOU", "NEARBY", "LATEST"].includes(params.mode ?? "")
    ? params.mode
    : "FOR_YOU";
  const query = new URLSearchParams({ mode: mode ?? "FOR_YOU", limit: "20" });
  if (params.cityId) query.set("cityId", params.cityId);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.subcategoryId) query.set("subcategoryId", params.subcategoryId);
  const [{ items: ads }, banners] = await Promise.all([
    fetchJson<{ items: Parameters<typeof AdFeed>[0]["ads"] }>(`/ads?${query}`, { items: [] }),
    fetchJson<Parameters<typeof LogoStrip>[0]["banners"]>("/banners", []),
  ]);

  return (
    <main>
      <LogoStrip banners={banners} />
      <div className="flex justify-center gap-2 bg-white px-3 py-3 text-sm font-bold">
        {[
          ["FOR_YOU", "لك"],
          ["NEARBY", "قريب منك"],
          ["LATEST", "الأحدث"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/?mode=${value}`}
            className={`rounded-full px-4 py-2 ${mode === value ? "bg-brand text-black" : "bg-zinc-100"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <AdFeed ads={ads} />
    </main>
  );
}
