"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type MediaAsset = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  thumbnailUrl: string | null;
  variants: Record<string, string> | null;
};

type Ad = {
  id: string;
  title: string;
  description: string | null;
  owner: {
    id: string;
    name: string | null;
    businessProfile: { slug: string; verified: boolean; logoUrl: string | null } | null;
  };
  city: { nameAr: string } | null;
  category: { nameAr: string };
  media: Array<{ id: string; mediaAsset: MediaAsset }>;
  contacts: Array<{ id: string; type: string; value: string; label: string | null }>;
};

function assetUrl(asset: MediaAsset) {
  return asset.variants?.optimized ?? asset.variants?.large ?? asset.variants?.medium ?? asset.thumbnailUrl;
}

function Video({ asset }: { asset: MediaAsset }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [controls, setControls] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio > 0.7) {
          void video.play();
          setControls(true);
          window.setTimeout(() => setControls(false), 2500);
        } else {
          video.pause();
        }
      },
      { threshold: [0.7] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full bg-black" onPointerMove={() => setControls(true)}>
      <video
        ref={ref}
        className="h-full w-full object-cover"
        src={assetUrl(asset) ?? undefined}
        poster={asset.thumbnailUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
      />
      <button
        type="button"
        className={`absolute left-4 top-4 rounded-full bg-black/60 px-3 py-2 text-sm text-white transition ${controls ? "opacity-100" : "opacity-0"}`}
        onClick={() => setMuted((value) => !value)}
        aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
      >
        {muted ? "تشغيل الصوت" : "كتم"}
      </button>
    </div>
  );
}

function Media({ items }: { items: Ad["media"] }) {
  if (items[0]?.mediaAsset.kind === "VIDEO") {
    return <Video asset={items[0].mediaAsset} />;
  }
  return (
    <div className="flex h-full snap-x snap-mandatory overflow-x-auto">
      {items.map(({ id, mediaAsset }, index) => (
        <div key={id} className="relative h-full min-w-full snap-center bg-zinc-900">
          {/* Native img keeps arbitrary S3-compatible development hosts supported. */}
          <img
            src={assetUrl(mediaAsset) ?? ""}
            alt={`صورة الإعلان ${index + 1}`}
            className="h-full w-full object-cover"
            loading={index ? "lazy" : "eager"}
          />
          {items.length > 1 && (
            <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
              {index + 1}/{items.length}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function contactHref(contact: Ad["contacts"][number]) {
  if (contact.type === "PHONE") return `tel:${contact.value}`;
  if (contact.type === "WHATSAPP") {
    return contact.value.startsWith("http")
      ? contact.value
      : `https://wa.me/${contact.value.replace(/\D/g, "")}`;
  }
  return contact.value;
}

export function AdFeed({ ads }: { ads: Ad[] }) {
  if (!ads.length) {
    return (
      <div className="mx-auto my-20 max-w-lg rounded-2xl bg-white p-8 text-center">
        <h1 className="text-xl font-black">لا توجد إعلانات مطابقة الآن</h1>
        <p className="mt-2 text-zinc-600">جرّب قسمًا أو مدينة أخرى.</p>
      </div>
    );
  }
  return (
    <section className="mx-auto h-[calc(100dvh-8rem)] max-w-xl snap-y snap-mandatory overflow-y-auto bg-black">
      {ads.map((ad) => (
        <article key={ad.id} className="relative h-full snap-start overflow-hidden">
          <Media items={ad.media} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-5 pt-28 text-white">
            <Link
              className="pointer-events-auto inline-flex items-center gap-2 font-bold"
              href={`/profiles/${ad.owner.businessProfile?.slug ?? ad.owner.id}`}
            >
              {ad.owner.name ?? "معلن"}
              {ad.owner.businessProfile?.verified && (
                <span aria-label="حساب موثق" className="text-brand">
                  ●
                </span>
              )}
            </Link>
            <Link href={`/ads/${ad.id}`} className="pointer-events-auto mt-2 block">
              <h2 className="text-xl font-black">{ad.title}</h2>
            </Link>
            {ad.description && <p className="mt-1 line-clamp-2 text-sm text-white/85">{ad.description}</p>}
            <p className="mt-2 text-xs text-white/70">
              {ad.category.nameAr} {ad.city ? `• ${ad.city.nameAr}` : "• كل المملكة"}
            </p>
            <div className="pointer-events-auto mt-4 flex flex-wrap gap-2">
              {ad.contacts.map((contact) => (
                <a
                  key={contact.id}
                  href={contactHref(contact)}
                  target={contact.type === "PHONE" ? undefined : "_blank"}
                  rel="noreferrer"
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-black"
                >
                  {contact.label ?? (contact.type === "WHATSAPP" ? "واتساب" : contact.type === "PHONE" ? "اتصال" : "زيارة الرابط")}
                </a>
              ))}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
