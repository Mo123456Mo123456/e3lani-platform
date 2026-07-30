import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Logo } from "@e3lani/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function getProfile(id: string) {
  const response = await fetch(`${api}/profiles/${id}`, { next: { revalidate: 60 } });
  if (!response.ok) return null;
  return response.json();
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "الحساب غير موجود" };
  return {
    title: profile.name ?? "معلن",
    description: profile.businessProfile?.bio ?? "شاهد إعلانات ومنشورات هذا الحساب على إعلاني.",
    openGraph: { images: profile.businessProfile?.coverUrl ? [profile.businessProfile.coverUrl] : [] }
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/profiles/${id}`;

  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-white pb-16">
      <header className="flex items-center justify-between p-4">
        <Link href="/"><Logo /></Link>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${profile.name ?? "إعلاني"} ${publicUrl}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border px-4 py-2 text-sm font-bold"
        >
          مشاركة
        </a>
      </header>
      <div className="h-44 bg-muted">
        {profile.businessProfile?.coverUrl && (
          <img src={profile.businessProfile.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <section className="-mt-12 px-5">
        <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-brand">
          {(profile.businessProfile?.logoUrl || profile.avatarUrl) && (
            <img src={profile.businessProfile?.logoUrl ?? profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-3xl font-black">{profile.name ?? "معلن"}</h1>
          {profile.businessProfile?.verifiedAt && <span className="rounded-full bg-brand px-2 py-1 text-xs font-bold">موثّق</span>}
        </div>
        <p className="mt-1 text-black/55">{profile.city?.nameAr} · {profile.views.toLocaleString("ar-SA")} مشاهدة</p>
        {profile.businessProfile?.bio && <p className="mt-3 max-w-2xl">{profile.businessProfile.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.businessProfile?.storeUrl && <a className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white" href={profile.businessProfile.storeUrl} target="_blank" rel="noreferrer">زيارة المتجر</a>}
          {profile.businessProfile?.websiteUrl && <a className="rounded-xl border px-4 py-2 text-sm font-bold" href={profile.businessProfile.websiteUrl} target="_blank" rel="noreferrer">الموقع</a>}
        </div>
      </section>
      <section className="mt-10 px-5">
        <h2 className="text-xl font-black">الإعلانات</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {profile.ads.map((ad: { id: string; title: string; media: { thumbnailUrl?: string; url?: string }[] }) => (
            <Link key={ad.id} href={`/ads/${ad.id}`}>
              <Card className="overflow-hidden">
                <img src={ad.media[0]?.thumbnailUrl ?? ad.media[0]?.url} alt={ad.title} className="aspect-[4/5] w-full bg-black object-contain" />
                <h3 className="p-3 font-bold">{ad.title}</h3>
              </Card>
            </Link>
          ))}
        </div>
        {!profile.ads.length && <p className="mt-3 text-sm text-black/50">لا توجد إعلانات نشطة حاليًا.</p>}
      </section>
      <section className="mt-10 px-5">
        <h2 className="text-xl font-black">المنشورات</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {profile.posts.map((post: { id: string; title: string; media: { thumbnailUrl?: string; url?: string }[] }) => (
            <Card key={post.id} className="overflow-hidden">
              <img src={post.media[0]?.thumbnailUrl ?? post.media[0]?.url} alt={post.title} className="aspect-square w-full bg-black object-contain" />
              <h3 className="p-3 font-bold">{post.title}</h3>
            </Card>
          ))}
        </div>
        {!profile.posts.length && <p className="mt-3 text-sm text-black/50">لا توجد منشورات بعد.</p>}
      </section>
    </main>
  );
}
