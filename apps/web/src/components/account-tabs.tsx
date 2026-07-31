'use client';

import * as React from 'react';
import Link from 'next/link';
import type { AdDto, PaginatedDto, PostDto } from '@e3lani/types';
import { EmptyState, formatPrice } from '@e3lani/ui';
import { getAccountAds, getAccountPosts } from '@/lib/api';

type Tab = 'ads' | 'posts';

/**
 * تبويبا صفحة الحساب.
 * المنشورات المجانية تُقرأ من مسار مستقل تمامًا ولا تظهر في موجز الإعلانات.
 */
export function AccountTabs({
  accountId,
  initialAds,
  initialPosts,
}: {
  accountId: string;
  initialAds: PaginatedDto<AdDto>;
  initialPosts: PaginatedDto<PostDto>;
}) {
  const [tab, setTab] = React.useState<Tab>('ads');
  const [ads, setAds] = React.useState(initialAds);
  const [posts, setPosts] = React.useState(initialPosts);
  const [loading, setLoading] = React.useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      if (tab === 'ads' && ads.nextCursor) {
        const page = await getAccountAds(accountId, ads.nextCursor);
        setAds({ ...page, items: [...ads.items, ...page.items] });
      } else if (tab === 'posts' && posts.nextCursor) {
        const page = await getAccountPosts(accountId, posts.nextCursor);
        setPosts({ ...page, items: [...posts.items, ...page.items] });
      }
    } finally {
      setLoading(false);
    }
  };

  const current = tab === 'ads' ? ads : posts;

  return (
    <section className="mt-5">
      <div role="tablist" className="flex border-b border-line px-4">
        {(
          [
            ['ads', 'الإعلانات'],
            ['posts', 'المنشورات'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 border-b-2 pb-2.5 text-sm font-bold transition-colors ${
              tab === key ? 'border-primary text-ink' : 'border-transparent text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'ads' ? (
          ads.items.length ? (
            <div className="grid grid-cols-2 gap-2">
              {ads.items.map((ad) => (
                <Link
                  key={ad.id}
                  href={`/ad/${ad.id}`}
                  className="overflow-hidden rounded-lg border border-line"
                >
                  <div className="aspect-[4/5] w-full bg-surface">
                    {ad.media[0]?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ad.media[0].thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-sm font-semibold">{ad.title}</p>
                    {ad.price !== null ? (
                      <p className="mt-1 text-sm font-bold text-ink">{formatPrice(ad.price)}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="لا توجد إعلانات نشطة" />
          )
        ) : posts.items.length ? (
          <div className="space-y-3">
            {posts.items.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-lg border border-line">
                {post.media[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.media[0].url}
                    alt=""
                    loading="lazy"
                    className="max-h-[420px] w-full object-cover"
                  />
                ) : null}
                <p className="whitespace-pre-wrap p-3 text-[15px] leading-7">{post.caption}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="لا توجد منشورات" description="المنشورات المجانية تظهر هنا فقط." />
        )}

        {current.hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="mt-4 w-full rounded-lg border border-line py-3 text-sm font-bold"
          >
            {loading ? 'جارٍ التحميل…' : 'عرض المزيد'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
