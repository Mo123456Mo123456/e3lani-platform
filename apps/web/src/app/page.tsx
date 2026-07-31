import { getFeed, getTicker } from '@/lib/api';
import { SiteHeader } from '@/components/site-header';
import { BottomNav } from '@/components/bottom-nav';
import { TickerStrip } from '@/components/ticker-strip';
import { FeedClient } from '@/components/feed-client';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; city?: string }>;
}) {
  const params = await searchParams;
  const tab = (params.tab ?? 'for-you') as 'for-you' | 'nearby' | 'latest';

  const [ticker, feed] = await Promise.all([
    getTicker().catch(() => ({ enabled: false, logos: [] })),
    getFeed({ tab, limit: 6, cityId: params.city }).catch(() => ({
      items: [],
      nextCursor: null,
      hasMore: false,
    })),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      {ticker.enabled ? <TickerStrip logos={ticker.logos} /> : null}
      <SiteHeader activeTab={tab} />
      <FeedClient
        initialItems={feed.items}
        initialCursor={feed.nextCursor}
        initialHasMore={feed.hasMore}
        tab={tab}
        cityId={params.city}
      />
      <BottomNav active="home" />
    </div>
  );
}
