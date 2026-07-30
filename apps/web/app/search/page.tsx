import { AdFeed } from "@/components/ad-feed";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() ?? "";
  let ads: Parameters<typeof AdFeed>[0]["ads"] = [];
  if (q) {
    try {
      const response = await fetch(
        `${api}/api/v1/ads/search?q=${encodeURIComponent(q)}&limit=20`,
        { cache: "no-store" },
      );
      if (response.ok) ads = (await response.json()) as typeof ads;
    } catch {
      ads = [];
    }
  }
  return (
    <main className="py-6">
      <form className="mx-auto mb-6 flex max-w-xl gap-2 px-4" action="/search">
        <input
          name="q"
          defaultValue={q}
          required
          minLength={2}
          placeholder="ابحث عن إعلان"
          className="min-h-12 flex-1 rounded-xl border border-black/20 bg-white px-4"
        />
        <button className="rounded-xl bg-brand px-6 font-black" type="submit">
          بحث
        </button>
      </form>
      {q ? (
        <AdFeed ads={ads} />
      ) : (
        <p className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">
          اكتب ما تبحث عنه لعرض الإعلانات المطابقة.
        </p>
      )}
    </main>
  );
}
