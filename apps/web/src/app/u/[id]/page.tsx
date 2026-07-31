import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Globe, MapPin, MessageCircle, Phone, Store } from 'lucide-react';
import { Avatar, formatNumber } from '@e3lani/ui';
import { ApiError, getAccount, getAccountAds, getAccountPosts } from '@/lib/api';
import { AccountTabs } from '@/components/account-tabs';
import { ShareButton } from '@/components/share-button';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const account = await getAccount(id);
    return { title: account.name, description: account.business?.bio ?? undefined };
  } catch {
    return { title: 'حساب' };
  }
}

/** صفحة صاحب الحساب / البراند — تبويبان: الإعلانات | المنشورات. */
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let account;
  try {
    account = await getAccount(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [ads, posts] = await Promise.all([
    getAccountAds(id).catch(() => ({ items: [], nextCursor: null, hasMore: false })),
    getAccountPosts(id).catch(() => ({ items: [], nextCursor: null, hasMore: false })),
  ]);

  const business = account.business;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[520px] border-x border-line bg-white pb-10">
      <div className="relative h-36 w-full bg-surface">
        {business?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-l from-primary/40 to-primary/10" />
        )}
      </div>

      <section className="-mt-10 px-4">
        <Avatar
          src={business?.logoUrl ?? account.avatarUrl}
          name={account.name}
          size={80}
          className="border-4 border-white shadow-card"
        />
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="inline-flex items-center gap-1.5 text-xl font-extrabold">
              {account.name}
              {account.isVerified ? <BadgeCheck size={18} className="text-primary" /> : null}
            </h1>
            {account.cityNameAr ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-ink-muted">
                <MapPin size={14} />
                {account.cityNameAr}
              </p>
            ) : null}
          </div>
          <ShareButton url={account.shareUrl} title={account.name} />
        </div>

        {business?.bio ? (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink">{business.bio}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {business?.whatsapp ? (
            <a
              href={`https://wa.me/${business.whatsapp}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-sm font-semibold"
            >
              <MessageCircle size={15} /> واتساب
            </a>
          ) : null}
          {business?.contactPhone ? (
            <a
              href={`tel:+${business.contactPhone}`}
              className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-sm font-semibold"
            >
              <Phone size={15} /> اتصال
            </a>
          ) : null}
          {business?.storeUrl ? (
            <a
              href={business.storeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-sm font-semibold"
            >
              <Store size={15} /> المتجر
            </a>
          ) : null}
          {business?.websiteUrl ? (
            <a
              href={business.websiteUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1.5 text-sm font-semibold"
            >
              <Globe size={15} /> الموقع
            </a>
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface p-3 text-center">
          <div>
            <dt className="text-xs text-ink-muted">الإعلانات</dt>
            <dd className="text-lg font-bold">{formatNumber(account.stats?.activeAds ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">المنشورات</dt>
            <dd className="text-lg font-bold">{formatNumber(account.stats?.posts ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">المشاهدات</dt>
            <dd className="text-lg font-bold">{formatNumber(account.stats?.totalViews ?? 0)}</dd>
          </div>
        </dl>
      </section>

      <AccountTabs accountId={id} initialAds={ads} initialPosts={posts} />

      <div className="px-4 pt-6 text-center">
        <Link href="/" className="text-sm font-semibold text-ink-muted underline">
          العودة إلى إعلاني
        </Link>
      </div>
    </main>
  );
}
