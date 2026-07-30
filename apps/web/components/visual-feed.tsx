"use client";

import type { FeedItem } from "@e3lani/types";
import { ExternalLink, MapPin, Share2, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function contactHref(contact: FeedItem["contact"]) {
  if (contact.type === "PHONE") return `tel:${contact.value}`;
  if (contact.type === "WHATSAPP") {
    const digits = contact.value.replace(/\D/g, "").replace(/^0/, "966");
    return `https://wa.me/${digits}`;
  }
  return contact.value;
}

function Media({
  media,
  title,
  active,
}: {
  media: FeedItem["media"];
  title: string;
  active: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!video.current) return;
    if (active) void video.current.play().catch(() => undefined);
    else video.current.pause();
  }, [active]);

  if (media[0]?.kind === "VIDEO") {
    return (
      <>
        <video
          ref={video}
          src={media[0].url}
          poster={media[0].thumbnailUrl ?? undefined}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-label={title}
        />
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="absolute end-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </>
    );
  }

  return (
    <>
      <div
        className="flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          setSlide(Math.round(event.currentTarget.scrollLeft / Math.max(width, 1)));
        }}
      >
        {media.map((item) => (
          <img
            key={item.id}
            src={item.url}
            alt={title}
            loading={slide > 1 ? "lazy" : "eager"}
            className="h-full min-w-full snap-center object-cover"
          />
        ))}
      </div>
      {media.length > 1 ? (
        <div className="absolute start-1/2 top-4 flex -translate-x-1/2 gap-1.5" aria-label={`${slide + 1} / ${media.length}`}>
          {media.map((item, index) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full ${index === slide ? "w-5 bg-e3-yellow" : "w-1.5 bg-white/70"}`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function Ad({ item, locale, active }: { item: FeedItem; locale: "ar" | "en"; active: boolean }) {
  const ar = locale === "ar";
  const [shared, setShared] = useState(false);
  const href = contactHref(item.contact);
  return (
    <article className="snap-ad relative isolate mx-auto w-full max-w-xl overflow-hidden bg-e3-black">
      <Media media={item.media} title={item.title} active={active} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-7 text-white">
        <Link
          href={`/${locale}/profile/${item.advertiser.slug}`}
          className="mb-3 inline-flex items-center gap-2 rounded-full bg-black/35 p-1 pe-3 backdrop-blur"
        >
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-e3-yellow font-black text-e3-black">
            {item.advertiser.avatarUrl ? (
              <img src={item.advertiser.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              item.advertiser.name.slice(0, 1)
            )}
          </span>
          <span className="font-bold">{item.advertiser.name}</span>
          {item.advertiser.verified ? <span aria-label={ar ? "موثق" : "Verified"}>✓</span> : null}
        </Link>
        <h2 className="max-w-md text-2xl font-black">{item.title}</h2>
        {item.description ? <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/85">{item.description}</p> : null}
        <p className="mt-2 flex items-center gap-1 text-xs text-white/80">
          <MapPin size={14} />
          {ar ? item.city.nameAr : item.city.nameEn}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <a
            href={href}
            target={href.startsWith("https://") ? "_blank" : undefined}
            rel={href.startsWith("https://") ? "noopener noreferrer" : undefined}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-e3-yellow px-5 font-black text-e3-black"
          >
            {ar ? "تواصل مع المعلن" : "Contact advertiser"}
            <ExternalLink size={18} />
          </a>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/${locale}/ad/${item.id}`;
              if (navigator.share) await navigator.share({ title: item.title, url });
              else await navigator.clipboard.writeText(url);
              setShared(true);
            }}
            className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur"
            aria-label={shared ? (ar ? "تم نسخ الرابط" : "Link copied") : ar ? "مشاركة" : "Share"}
          >
            <Share2 size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function VisualFeed({ items, locale }: { items: FeedItem[]; locale: "ar" | "en" }) {
  const [active, setActive] = useState(items[0]?.id);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target instanceof HTMLElement) setActive(visible.target.dataset.id);
      },
      { root: container.current, threshold: [0.55, 0.8] },
    );
    container.current.querySelectorAll("[data-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="grid min-h-[55vh] place-items-center px-6 text-center">
        <div>
          <p className="text-xl font-black">
            {locale === "ar" ? "لا توجد إعلانات مطابقة الآن" : "No matching ads right now"}
          </p>
          <p className="mt-2 text-sm text-black/55">
            {locale === "ar" ? "جرّب قسمًا أو مدينة أخرى." : "Try another category or city."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={container} id="feed" className="snap-feed bg-black">
      {items.map((item) => (
        <div key={item.id} data-id={item.id}>
          <Ad item={item} locale={locale} active={active === item.id} />
        </div>
      ))}
    </div>
  );
}
