"use client";

import {
  Bell,
  Bookmark,
  Building2,
  ExternalLink,
  Home,
  Layers3,
  Plus,
  Search,
  Share2,
  UserRound,
  Volume2,
  VolumeX
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@e3lani/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface FeedAd {
  id: string;
  title: string;
  description?: string;
  contactType: "STORE" | "PRODUCT" | "WHATSAPP" | "PHONE" | "EXTERNAL";
  contactValue: string;
  city: { nameAr: string };
  category: { nameAr: string };
  owner: {
    id: string;
    name?: string;
    avatarUrl?: string;
    businessProfile?: { logoUrl?: string; verifiedAt?: string };
  };
  media: {
    id: string;
    kind: "IMAGE" | "VIDEO";
    url?: string;
    thumbnailUrl?: string;
  }[];
}

function contactHref(ad: FeedAd) {
  if (ad.contactType === "WHATSAPP") return `https://wa.me/${ad.contactValue.replace("+", "")}`;
  if (ad.contactType === "PHONE") return `tel:${ad.contactValue}`;
  return ad.contactValue;
}

function MediaViewer({ ad }: { ad: FeedAd }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!rootRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.7 }
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden bg-black">
      <div
        className="hide-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          setActiveImage(Math.round(event.currentTarget.scrollLeft / Math.max(width, 1)));
        }}
      >
        {ad.media.map((media) =>
          media.kind === "VIDEO" ? (
            <video
              key={media.id}
              ref={videoRef}
              src={media.url}
              poster={media.thumbnailUrl}
              className="h-full w-full shrink-0 snap-center object-contain"
              loop
              muted={muted}
              playsInline
              preload="metadata"
              aria-label={ad.title}
            />
          ) : (
            <img
              key={media.id}
              src={media.url}
              alt={ad.title}
              className="h-full w-full shrink-0 snap-center object-contain"
              loading={activeImage > 0 ? "lazy" : "eager"}
            />
          )
        )}
      </div>
      {ad.media[0]?.kind === "VIDEO" && (
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      )}
      {ad.media.length > 1 && (
        <div className="absolute top-5 right-1/2 flex translate-x-1/2 gap-1.5">
          {ad.media.map((media, index) => (
            <span
              key={media.id}
              className={`h-1.5 rounded-full ${index === activeImage ? "w-5 bg-brand" : "w-1.5 bg-white/65"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdSlide({ ad }: { ad: FeedAd }) {
  return (
    <article className="relative h-[calc(100dvh-7.75rem)] min-h-[540px] snap-start overflow-hidden bg-black">
      <MediaViewer ad={ad} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-7 pt-32 text-white">
        <Link
          href={`/profiles/${ad.owner.id}`}
          className="pointer-events-auto mb-3 inline-flex items-center gap-2"
        >
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-brand font-black text-ink">
            {ad.owner.businessProfile?.logoUrl || ad.owner.avatarUrl ? (
              <img
                src={ad.owner.businessProfile?.logoUrl ?? ad.owner.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              ad.owner.name?.slice(0, 1) ?? <Building2 size={18} />
            )}
          </span>
          <strong>{ad.owner.name ?? "معلن"}</strong>
          {ad.owner.businessProfile?.verifiedAt && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-ink">موثّق</span>
          )}
        </Link>
        <h2 className="text-2xl font-black">{ad.title}</h2>
        {ad.description && <p className="mt-1 line-clamp-2 text-sm text-white/80">{ad.description}</p>}
        <p className="mt-2 text-xs text-white/65">
          {ad.category.nameAr} · {ad.city.nameAr}
        </p>
        <div className="pointer-events-auto mt-4 flex items-center gap-2">
          <a
            href={contactHref(ad)}
            target={ad.contactType === "PHONE" ? undefined : "_blank"}
            rel="noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-black text-ink"
          >
            تواصل مع المعلن <ExternalLink size={17} />
          </a>
          <button
            type="button"
            onClick={() => void navigator.share?.({ title: ad.title, url: `${location.origin}/ads/${ad.id}` })}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"
            aria-label="مشاركة"
          >
            <Share2 size={20} />
          </button>
          <Link
            href="/login"
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"
            aria-label="حفظ"
          >
            <Bookmark size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function LogoStrip() {
  const [logos, setLogos] = useState<{ id: string; logoUrl: string }[]>([]);
  useEffect(() => {
    fetch(`${api}/banners`)
      .then((response) => (response.ok ? response.json() : []))
      .then(setLogos)
      .catch(() => setLogos([]));
  }, []);
  if (!logos.length) return null;
  const sequence = [...logos, ...logos];
  return (
    <div className="pointer-events-none h-12 overflow-hidden border-b border-black/10 bg-white" aria-hidden>
      <div className="logo-strip flex h-full w-max items-center gap-6 px-4">
        {sequence.map((logo, index) => (
          <div key={`${logo.id}-${index}`} className="flex items-center gap-6">
            <img src={logo.logoUrl} alt="" className="h-7 w-20 object-contain" draggable={false} />
            <Logo compact />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Feed() {
  const [mode, setMode] = useState<"FOR_YOU" | "NEARBY" | "LATEST">("FOR_YOU");
  const [ads, setAds] = useState<FeedAd[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ mode });
    if (query) params.set("q", query);
    fetch(`${api}/feed?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("feed");
        return response.json();
      })
      .then((result: { items: FeedAd[] }) => setAds(result.items))
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setAds([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [mode, query]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg overflow-hidden bg-white shadow-2xl">
      <LogoStrip />
      <header className="sticky top-0 z-30 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/login" aria-label="الإشعارات" className="grid h-10 w-10 place-items-center">
            <Bell size={21} />
          </Link>
        </div>
        <div className="mt-2 flex gap-2">
          {[
            ["FOR_YOU", "لك"],
            ["NEARBY", "قريب منك"],
            ["LATEST", "الأحدث"]
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMode(value as typeof mode)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${mode === value ? "bg-ink text-white" : "bg-muted text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mt-2 flex h-10 items-center gap-2 rounded-xl bg-muted px-3">
          <Search size={17} className="text-black/50" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث في الإعلانات"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </header>
      <section className="hide-scrollbar h-[calc(100dvh-12.25rem)] min-h-[540px] snap-y snap-mandatory overflow-y-auto bg-black">
        {loading ? (
          <div className="grid h-full place-items-center text-white">جارٍ تحميل الإعلانات…</div>
        ) : ads.length ? (
          ads.map((ad) => <AdSlide key={ad.id} ad={ad} />)
        ) : (
          <div className="grid h-full place-items-center px-8 text-center text-white">
            لا توجد إعلانات مطابقة الآن. جرّب بحثًا أو قسمًا آخر.
          </div>
        )}
      </section>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-16 max-w-lg items-end justify-around border-t border-black/10 bg-white px-2 pb-1">
        <Link href="/" className="grid place-items-center text-xs font-bold"><Home size={21} />الرئيسية</Link>
        <Link href="/#categories" className="grid place-items-center text-xs"><Layers3 size={21} />الأقسام</Link>
        <a href="e3lani://create-ad" className="-mt-4 grid h-14 w-14 place-items-center rounded-full bg-brand text-xs font-black shadow-lg"><Plus size={25} />أضف</a>
        <Link href="/login?next=/saved" className="grid place-items-center text-xs"><Bookmark size={21} />المحفوظات</Link>
        <Link href="/login" className="grid place-items-center text-xs"><UserRound size={21} />حسابي</Link>
      </nav>
    </main>
  );
}
