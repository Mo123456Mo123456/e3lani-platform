'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { api, getToken, setToken } from '../../lib/api';
import { statusLabel } from '../../lib/status';

export default function AccountPage() {
  const router = useRouter();
  const [ads, setAds] = useState<AdDetail[]>([]);
  const [me, setMe] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    Promise.all([api.me(), api.myAds()])
      .then(([user, list]) => {
        setMe(user);
        setAds(list);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="container stack">
      <div className="panel stack">
        <h1 style={{ margin: 0 }}>حسابي</h1>
        <p className="muted">{String(me?.phone ?? '')}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link className="btn btn-primary" href="/ads/new">
            إعلان جديد
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setToken(null);
              router.push('/login');
            }}
          >
            خروج
          </button>
        </div>
      </div>
      <h2>إعلاناتي</h2>
      <div className="stack">
        {ads.map((ad) => (
          <div key={ad.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <strong>{ad.currentRevision?.title}</strong>
              <div className="muted">{statusLabel(ad.status)}</div>
            </div>
            <Link className="btn btn-ghost" href={`/ads/${ad.id}/status`}>
              التفاصيل
            </Link>
          </div>
        ))}
        {ads.length === 0 ? <p className="muted">لا توجد إعلانات بعد.</p> : null}
      </div>
    </main>
  );
}
