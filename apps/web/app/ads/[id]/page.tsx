import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@e3lani/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function getAd(id: string) {
  const response = await fetch(`${api}/ads/${id}`, { next: { revalidate: 30 } });
  return response.ok ? response.json() : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ad = await getAd(id);
  if (!ad) return { title: "الإعلان غير موجود" };
  return {
    title: ad.title,
    description: ad.description,
    openGraph: { images: ad.media[0]?.thumbnailUrl ? [ad.media[0].thumbnailUrl] : [] }
  };
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await getAd(id);
  if (!ad) notFound();
  const href =
    ad.contactType === "WHATSAPP"
      ? `https://wa.me/${ad.contactValue.replace("+", "")}`
      : ad.contactType === "PHONE"
        ? `tel:${ad.contactValue}`
        : ad.contactValue;
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white pb-24">
      <header className="flex items-center justify-between p-4">
        <Link href="/"><Logo /></Link>
        <Link href={`/profiles/${ad.owner.id}`} className="font-bold">{ad.owner.name ?? "المعلن"}</Link>
      </header>
      <div className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto bg-black">
        {ad.media.map((media: { id: string; kind: string; url?: string; thumbnailUrl?: string }) =>
          media.kind === "VIDEO" ? (
            <video key={media.id} src={media.url} poster={media.thumbnailUrl} controls playsInline className="aspect-[4/5] w-full shrink-0 snap-center object-contain" />
          ) : (
            <img key={media.id} src={media.url} alt={ad.title} className="aspect-[4/5] w-full shrink-0 snap-center object-contain" />
          )
        )}
      </div>
      <section className="p-5">
        <p className="text-sm text-black/50">{ad.category.nameAr} · {ad.city.nameAr}</p>
        <h1 className="mt-2 text-3xl font-black">{ad.title}</h1>
        {ad.description && <p className="mt-4 whitespace-pre-wrap leading-8">{ad.description}</p>}
      </section>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t bg-white p-4">
        <a href={href} target={ad.contactType === "PHONE" ? undefined : "_blank"} rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-brand font-black">
          تواصل مباشرة مع المعلن
        </a>
      </div>
    </main>
  );
}
