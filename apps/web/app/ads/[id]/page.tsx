'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { api } from '../../../lib/api';
import { statusLabel } from '../../../lib/status';

export default function AdPage() {
  const params = useParams<{ id: string }>();
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [error, setError] = useState('');
  const [watching, setWatching] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .getAd(params.id)
      .then(setAd)
      .catch((e) => setError((e as Error).message));
  }, [params.id]);

  function revealTools() {
    setWatching(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setWatching(true), 1800);
  }

  useEffect(() => {
    revealTools();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [ad?.id]);

  if (error) return <main className="container"><p className="error">{error}</p></main>;
  if (!ad) return <main className="container"><p className="muted">جاري التحميل...</p></main>;

  const media = ad.media?.[0]?.asset;
  const contact = ad.currentRevision?.contactMethods;

  return (
    <main className="container stack">
      <div
        className={`ad-player ${watching ? 'watching' : ''}`}
        onMouseMove={revealTools}
        onTouchStart={revealTools}
        onClick={revealTools}
      >
        {media?.kind === 'VIDEO' ? (
          <video controls playsInline poster={media.urls?.poster ?? undefined} src={media.urls?.playback} />
        ) : media ? (
          <img src={media.urls?.playback || media.urls?.source} alt="" />
        ) : null}
        <div className="player-actions">
          {contact?.storeUrl ? (
            <a className="btn btn-primary" href={contact.storeUrl} target="_blank" rel="noreferrer">
              زيارة المتجر
            </a>
          ) : null}
          {contact?.whatsapp ? (
            <a className="btn btn-dark" href={`https://wa.me/${contact.whatsapp.replace('+', '')}`} target="_blank" rel="noreferrer">
              واتساب
            </a>
          ) : null}
        </div>
      </div>
      <div className="panel stack">
        <span className="badge">{statusLabel(ad.status)}</span>
        <h1 style={{ margin: 0 }}>{ad.currentRevision?.title}</h1>
        <p className="muted">
          {ad.currentRevision?.city?.nameAr} · {ad.currentRevision?.category?.nameAr}
        </p>
        <p>{ad.currentRevision?.description}</p>
        {ad.owner?.brandProfile?.slug ? (
          <Link href={`/brands/${ad.owner.brandProfile.slug}`}>صفحة البراند</Link>
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" href={`/ads/${ad.id}/status`}>
            حالة الإعلان
          </Link>
        </div>
      </div>
    </main>
  );
}
