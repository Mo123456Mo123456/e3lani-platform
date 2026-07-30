'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { LogoTicker } from '../../components/LogoTicker';
import { api } from '../../lib/api';
import { useLocale } from '../../lib/locale';

export default function BrowsePage() {
  const { locale, tr } = useLocale();
  const [tab, setTab] = useState<'forYou' | 'latest' | 'nearby'>('forYou');
  const [items, setItems] = useState<AdDetail[]>([]);
  const [error, setError] = useState('');
  const [chromeHidden, setChromeHidden] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .feed(tab)
      .then((page) => {
        if (alive) setItems(page.items);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [tab]);

  function bumpChrome() {
    setChromeHidden(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeHidden(true), 2200);
  }

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [items.length, tab]);

  return (
    <main className={`container feed-shell ${chromeHidden ? 'chrome-hidden' : ''}`}>
      <LogoTicker />
      <div className="feed-toolbar" onMouseMove={bumpChrome} onTouchStart={bumpChrome}>
        <h1 style={{ margin: 0 }}>{locale === 'ar' ? 'التصفح' : 'Browse'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {(
            [
              ['forYou', tr('feed.forYou')],
              ['nearby', tr('feed.nearby')],
              ['latest', tr('feed.latest')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'btn btn-primary' : 'btn btn-ghost'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
          <Link className="btn btn-ghost" href="/search">
            {locale === 'ar' ? 'فلاتر' : 'Filters'}
          </Link>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {!error && items.length === 0 ? (
        <p className="muted">{locale === 'ar' ? 'لا توجد إعلانات نشطة بعد.' : 'No active ads yet.'}</p>
      ) : null}
      <div className="feed-list" style={{ marginTop: 18 }} onMouseMove={bumpChrome} onClick={bumpChrome}>
        {items.map((ad) => {
          const media =
            ad.media?.find((row) => row.asset?.kind === 'VIDEO')?.asset ??
            ad.media?.[0]?.asset;
          const isVideo = media?.kind === 'VIDEO';
          return (
            <Link key={ad.id} href={`/ads/${ad.id}`} className="feed-card">
              {media ? (
                isVideo ? (
                  <video
                    src={media.urls?.playback}
                    poster={media.urls?.poster ?? undefined}
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <img src={media.urls?.playback || media.urls?.source} alt={ad.currentRevision?.title ?? ''} />
                )
              ) : (
                <div style={{ position: 'absolute', inset: 0, background: '#252525' }} />
              )}
              <div className="feed-meta">
                <div className="badge">{ad.owner?.brandProfile?.nameAr || ad.owner?.displayName || 'معلن'}</div>
                <h2 style={{ margin: '10px 0 4px' }}>{ad.currentRevision?.title}</h2>
                <p className="muted" style={{ color: 'rgba(255,255,255,.8)', margin: 0 }}>
                  {ad.currentRevision?.city?.nameAr} · {ad.currentRevision?.category?.nameAr}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
