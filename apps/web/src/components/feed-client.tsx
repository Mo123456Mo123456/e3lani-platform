'use client';

import * as React from 'react';
import type { AdDto } from '@e3lani/types';
import { EmptyState, Spinner } from '@e3lani/ui';
import { getFeed } from '@/lib/api';
import { deviceId, track } from '@/lib/track';
import { AdCard } from './ad-card';

interface FeedClientProps {
  initialItems: AdDto[];
  initialCursor: string | null;
  initialHasMore: boolean;
  tab: 'for-you' | 'nearby' | 'latest';
  cityId?: string;
}

/**
 * التصفح العمودي: إعلان واحد يملأ الشاشة، التالي بالتمرير.
 * يشغّل الفيديو تلقائيًا عند ظهور البطاقة ويوقفه فور الانتقال.
 */
export function FeedClient({
  initialItems,
  initialCursor,
  initialHasMore,
  tab,
  cityId,
}: FeedClientProps) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);
  const [activeId, setActiveId] = React.useState(initialItems[0]?.id ?? null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const seen = React.useRef(new Set<string>());

  React.useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    setActiveId(initialItems[0]?.id ?? null);
  }, [initialItems, initialCursor, initialHasMore]);

  const loadMore = React.useCallback(async () => {
    if (!hasMore || loading || !cursor) return;
    setLoading(true);
    try {
      const page = await getFeed({ tab, cursor, limit: 6, cityId, deviceId: deviceId() });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading, tab, cityId]);

  // يحدد البطاقة الظاهرة ويسجّل الظهور مرة واحدة لكل إعلان
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const id = (entry.target as HTMLElement).dataset.adId;
          if (!id) continue;
          setActiveId(id);
          if (!seen.current.has(id)) {
            seen.current.add(id);
            track(id, 'IMPRESSION');
          }
        }
      },
      { root, threshold: [0.6] },
    );

    root.querySelectorAll('[data-ad-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  // تحميل الصفحة التالية قبل الوصول للنهاية
  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const sentinel = root.querySelector('[data-sentinel]');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, items.length]);

  if (!items.length) {
    return (
      <div className="flex-1 p-6">
        <EmptyState
          title="لا توجد إعلانات بعد"
          description="جرّب تبويبًا آخر أو ابحث عن قسم يهمّك."
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="snap-feed no-scrollbar flex-1 overflow-y-auto"
      style={{ ['--chrome-height' as string]: '168px' }}
    >
      {items.map((ad) => (
        <div key={ad.id} data-ad-id={ad.id}>
          <AdCard ad={ad} active={activeId === ad.id} />
        </div>
      ))}

      <div data-sentinel className="flex h-16 items-center justify-center">
        {loading ? <Spinner /> : hasMore ? null : (
          <span className="text-xs text-ink-muted">وصلت إلى نهاية القائمة</span>
        )}
      </div>
    </div>
  );
}
