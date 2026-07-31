'use client';

import Link from 'next/link';
import { BadgeCheck, Eye, MapPin } from 'lucide-react';
import type { AdDto } from '@e3lani/types';
import { Avatar, Badge, MediaCarousel, formatNumber, formatPrice, timeAgo } from '@e3lani/ui';
import { AdActions } from './ad-actions';

/** بطاقة إعلان داخل التصفح العمودي — تملأ الشاشة إعلانًا بعد إعلان. */
export function AdCard({ ad, active }: { ad: AdDto; active: boolean }) {
  const price = formatPrice(ad.price, 'ar');

  return (
    <article className="relative flex h-[calc(100dvh-var(--chrome-height,168px))] w-full flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <MediaCarousel
          media={ad.media.map((item) => ({
            id: item.id,
            type: item.type,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            blurhash: item.blurhash,
            aspectRatio: item.aspectRatio,
          }))}
          active={active}
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 pb-5">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {ad.isHighlighted ? <Badge tone="primary">مميز</Badge> : null}
            {ad.isTopOfCategory ? <Badge tone="primary">أعلى القسم</Badge> : null}
            {ad.isPromoted ? <Badge tone="neutral">ممول</Badge> : null}
            {ad.category ? (
              <Link
                href={`/search?categoryId=${ad.category.id}`}
                className="rounded-pill bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"
              >
                {ad.category.nameAr}
              </Link>
            ) : null}
          </div>

          <Link href={`/ad/${ad.id}`} className="pointer-events-auto mt-2 block">
            <h2 className="line-clamp-2 text-lg font-extrabold text-white">{ad.title}</h2>
          </Link>

          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-white/85">
            {price ? <span className="text-base font-bold text-primary">{price}</span> : null}
            {ad.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} />
                {ad.city.nameAr}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Eye size={13} />
              {formatNumber(ad.viewsCount)}
            </span>
            {ad.publishedAt ? <span>{timeAgo(ad.publishedAt)}</span> : null}
          </div>

          <Link
            href={`/u/${ad.owner.id}`}
            className="pointer-events-auto mt-3 inline-flex items-center gap-2 text-white"
          >
            <Avatar src={ad.owner.avatarUrl} name={ad.owner.name} size={32} />
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              {ad.owner.name}
              {ad.owner.isVerified ? <BadgeCheck size={15} className="text-primary" /> : null}
            </span>
          </Link>
        </div>
      </div>

      <div className="bg-white px-3 py-2.5">
        <AdActions ad={ad} />
      </div>
    </article>
  );
}
