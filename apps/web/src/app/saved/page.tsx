'use client';

import * as React from 'react';
import Link from 'next/link';
import type { AdDto, PaginatedDto, PostDto } from '@e3lani/types';
import { Button, EmptyState, Spinner, formatPrice } from '@e3lani/ui';
import { authedFetch, session } from '@/lib/session';
import { BottomNav } from '@/components/bottom-nav';

export default function SavedPage() {
  const [tab, setTab] = React.useState<'ads' | 'posts'>('ads');
  const [ads, setAds] = React.useState<AdDto[]>([]);
  const [posts, setPosts] = React.useState<PostDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [authed, setAuthed] = React.useState(true);

  React.useEffect(() => {
    if (!session.accessToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [adsPage, postsPage] = await Promise.all([
          authedFetch<PaginatedDto<AdDto>>('/saved/ads'),
          authedFetch<PaginatedDto<PostDto>>('/saved/posts'),
        ]);
        setAds(adsPage.items);
        setPosts(postsPage.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      <header className="border-b border-line px-4 py-3">
        <h1 className="text-lg font-extrabold">المحفوظات</h1>
      </header>

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
            className={`flex-1 border-b-2 pb-2.5 pt-2 text-sm font-bold ${
              tab === key ? 'border-primary text-ink' : 'border-transparent text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3">
        {!authed ? (
          <EmptyState
            title="سجّل الدخول لعرض محفوظاتك"
            action={
              <Link href="/login?next=/saved">
                <Button>تسجيل الدخول</Button>
              </Link>
            }
          />
        ) : loading ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : tab === 'ads' ? (
          ads.length ? (
            <div className="grid grid-cols-2 gap-2">
              {ads.map((ad) => (
                <Link key={ad.id} href={`/ad/${ad.id}`} className="overflow-hidden rounded-lg border border-line">
                  <div className="aspect-[4/5] bg-surface">
                    {ad.media[0]?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.media[0].thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-sm font-semibold">{ad.title}</p>
                    {ad.price !== null ? <p className="text-sm font-bold">{formatPrice(ad.price)}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="لا توجد إعلانات محفوظة" />
          )
        ) : posts.length ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/u/${post.owner.id}`}
                className="block overflow-hidden rounded-lg border border-line"
              >
                {post.media[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media[0].url} alt="" className="max-h-72 w-full object-cover" />
                ) : null}
                <p className="line-clamp-3 p-3 text-sm">{post.caption}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="لا توجد منشورات محفوظة" />
        )}
      </div>

      <BottomNav active="saved" />
    </div>
  );
}
