import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BadgeCheck, Eye, MapPin, Tag } from 'lucide-react';
import { Avatar, Badge, formatNumber, formatPrice, timeAgo } from '@e3lani/ui';
import { ApiError, getAd } from '@/lib/api';
import { AdMediaViewer } from '@/components/ad-media-viewer';
import { AdActions } from '@/components/ad-actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const ad = await getAd(id);
    return {
      title: ad.title,
      description: ad.description ?? ad.title,
      openGraph: {
        title: ad.title,
        description: ad.description ?? undefined,
        images: ad.media[0]?.thumbnailUrl ? [ad.media[0].thumbnailUrl] : undefined,
      },
    };
  } catch {
    return { title: 'إعلان' };
  }
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ad;
  try {
    ad = await getAd(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const price = formatPrice(ad.price, 'ar');

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[520px] border-x border-line bg-white pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white/95 px-3 py-2.5 backdrop-blur">
        <Link href="/" aria-label="رجوع" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface">
          <ArrowRight size={20} />
        </Link>
        <h1 className="line-clamp-1 text-base font-bold">{ad.title}</h1>
      </header>

      <AdMediaViewer ad={ad} />

      <section className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {ad.isHighlighted ? <Badge tone="primary">مميز</Badge> : null}
          {ad.isTopOfCategory ? <Badge tone="primary">أعلى القسم</Badge> : null}
          {ad.category ? (
            <Link href={`/search?categoryId=${ad.category.id}`}>
              <Badge tone="neutral">{ad.category.nameAr}</Badge>
            </Link>
          ) : null}
          {ad.subcategory ? <Badge tone="neutral">{ad.subcategory.nameAr}</Badge> : null}
        </div>

        <h2 className="text-xl font-extrabold leading-snug">{ad.title}</h2>

        {price ? (
          <p className="inline-flex items-center gap-2 text-2xl font-extrabold text-ink">
            <Tag size={20} className="text-primary" />
            {price}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
          {ad.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={15} />
              {ad.city.nameAr}
              {ad.reachScope === 'KINGDOM' ? ' · جميع مناطق المملكة' : ''}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Eye size={15} />
            {formatNumber(ad.viewsCount)} مشاهدة
          </span>
          {ad.publishedAt ? <span>{timeAgo(ad.publishedAt)}</span> : null}
        </div>

        {ad.description ? (
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">{ad.description}</p>
        ) : null}

        <Link
          href={`/u/${ad.owner.id}`}
          className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-surface"
        >
          <Avatar src={ad.owner.avatarUrl} name={ad.owner.name} size={48} />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1 font-bold">
              {ad.owner.name}
              {ad.owner.isVerified ? <BadgeCheck size={16} className="text-primary" /> : null}
            </p>
            <p className="text-xs text-ink-muted">
              {ad.owner.accountType === 'INDIVIDUAL' ? 'حساب فردي' : 'حساب تجاري'}
              {ad.owner.cityNameAr ? ` · ${ad.owner.cityNameAr}` : ''}
            </p>
          </div>
          <span className="text-sm font-semibold text-ink-muted">عرض الصفحة</span>
        </Link>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[520px] border-t border-line bg-white p-3">
        <AdActions ad={ad} />
      </div>
    </main>
  );
}
