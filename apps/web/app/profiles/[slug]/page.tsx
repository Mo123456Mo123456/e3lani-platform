import { notFound } from "next/navigation";

import { ShareButton } from "@/components/share-button";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

type ProfileMedia = {
  id: string;
  mediaAsset: {
    thumbnailUrl: string | null;
    variants: Record<string, string> | null;
  };
};

type Profile = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  city: { nameAr: string } | null;
  views: number;
  businessProfile: {
    logoUrl: string | null;
    coverUrl: string | null;
    bio: string | null;
    verified: boolean;
    websiteUrl: string | null;
    whatsapp: string | null;
  } | null;
  ads: Array<{
    id: string;
    title: string;
    media: ProfileMedia[];
  }>;
  posts: Array<{
    id: string;
    caption: string | null;
    media: ProfileMedia[];
  }>;
};

function mediaUrl(item: ProfileMedia | undefined) {
  return (
    item?.mediaAsset.variants?.medium ??
    item?.mediaAsset.variants?.large ??
    item?.mediaAsset.thumbnailUrl ??
    ""
  );
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const response = await fetch(`${api}/api/v1/profiles/${(await params).slug}`, {
    cache: "no-store",
  });
  if (!response.ok) notFound();
  const profile = (await response.json()) as Profile;
  const image = profile.businessProfile?.logoUrl ?? profile.avatarUrl;

  return (
    <main className="mx-auto max-w-5xl pb-16">
      <div className="h-48 bg-zinc-200 sm:h-64">
        {profile.businessProfile?.coverUrl && (
          <img
            src={profile.businessProfile.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <section className="-mt-12 px-4">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-brand">
              {image && <img src={image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black">
                {profile.name ?? "معلن"}{" "}
                {profile.businessProfile?.verified && <span className="text-brand">●</span>}
              </h1>
              <p className="text-sm text-zinc-500">
                {profile.city?.nameAr ?? "المملكة العربية السعودية"} • {profile.views} مشاهدة
              </p>
            </div>
            <ShareButton title={profile.name ?? "إعلاني"} />
          </div>
          {profile.businessProfile?.bio && (
            <p className="mt-4 max-w-2xl text-zinc-700">{profile.businessProfile.bio}</p>
          )}
          <div className="mt-4 flex gap-3">
            {profile.businessProfile?.websiteUrl && (
              <a className="font-bold underline" href={profile.businessProfile.websiteUrl}>
                المتجر
              </a>
            )}
            {profile.businessProfile?.whatsapp && (
              <a
                className="font-bold underline"
                href={`https://wa.me/${profile.businessProfile.whatsapp.replace(/\D/g, "")}`}
              >
                واتساب
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 pt-10">
        <h2 className="border-b-4 border-brand pb-3 text-xl font-black">الإعلانات</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {profile.ads.map((ad) => (
            <a key={ad.id} href={`/ads/${ad.id}`} className="overflow-hidden rounded-2xl bg-white">
              <img src={mediaUrl(ad.media[0])} alt="" className="aspect-square w-full object-cover" />
              <h3 className="p-3 font-bold">{ad.title}</h3>
            </a>
          ))}
        </div>
      </section>

      <section className="px-4 pt-10">
        <h2 className="border-b-4 border-brand pb-3 text-xl font-black">المنشورات</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {profile.posts.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-2xl bg-white">
              <img src={mediaUrl(post.media[0])} alt="" className="aspect-square w-full object-cover" />
              {post.caption && <p className="p-3 text-sm">{post.caption}</p>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
