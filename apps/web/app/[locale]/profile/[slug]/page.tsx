import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProfile } from "@/lib/api";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const profile = await getProfile(slug);
    return {
      title: profile.name,
      description: profile.bio ?? `إعلانات ومنشورات ${profile.name} على إعلاني`,
      openGraph: { images: profile.coverUrl ? [profile.coverUrl] : [] },
    };
  } catch {
    return { title: "الحساب غير موجود" };
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: "ar" | "en"; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ar = locale === "ar";
  let profile;
  try {
    profile = await getProfile(slug);
  } catch {
    notFound();
  }

  const card = (item: (typeof profile.posts)[number]) => (
    <article key={item.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
      {item.media[0] ? (
        item.media[0].kind === "VIDEO" ? (
          <video
            src={item.media[0].url}
            poster={item.media[0].thumbnailUrl ?? undefined}
            controls
            preload="metadata"
            className="aspect-square w-full object-cover"
          />
        ) : (
          <img src={item.media[0].url} alt={item.title} className="aspect-square w-full object-cover" />
        )
      ) : null}
      <div className="p-4">
        <h2 className="font-black">{item.title}</h2>
        {item.description ? <p className="mt-1 line-clamp-2 text-sm text-black/60">{item.description}</p> : null}
      </div>
    </article>
  );

  return (
    <main className="min-h-screen pb-16">
      <div className="h-48 bg-e3-black sm:h-72">
        {profile.coverUrl ? <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <section className="mx-auto -mt-12 max-w-5xl px-4">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-e3-yellow text-4xl font-black shadow">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
              ) : (
                profile.name.slice(0, 1)
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-black">
                {profile.name} {profile.verified ? <span className="text-e3-yellow" aria-label={ar ? "موثق" : "Verified"}>✓</span> : null}
              </h1>
              {profile.bio ? <p className="mt-2 max-w-2xl text-black/60">{profile.bio}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.links)
                .filter((entry): entry is [string, string] => Boolean(entry[1]))
                .map(([key, value]) => {
                  const href =
                    key === "phone"
                      ? `tel:${value}`
                      : key === "whatsapp"
                        ? `https://wa.me/${value.replace(/\D/g, "").replace(/^0/, "966")}`
                        : value;
                  return (
                    <a
                      key={key}
                      href={href}
                      target={href.startsWith("https://") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="rounded-xl bg-e3-yellow px-4 py-2 text-sm font-black"
                    >
                      {key}
                    </a>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-2 border-b border-black/10">
          <a href="#ads" className="border-b-4 border-e3-yellow px-5 py-3 font-black">
            {ar ? "الإعلانات" : "Ads"} ({profile.ads.length})
          </a>
          <a href="#posts" className="px-5 py-3 font-black">
            {ar ? "المنشورات" : "Posts"} ({profile.posts.length})
          </a>
        </div>

        <section id="ads" className="pt-8">
          <h2 className="mb-4 text-xl font-black">{ar ? "الإعلانات النشطة" : "Active ads"}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{profile.ads.map(card)}</div>
        </section>
        <section id="posts" className="pt-12">
          <h2 className="mb-4 text-xl font-black">{ar ? "المنشورات المجانية" : "Free posts"}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{profile.posts.map(card)}</div>
        </section>
      </section>
    </main>
  );
}
