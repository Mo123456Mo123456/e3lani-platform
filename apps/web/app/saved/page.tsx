'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { api, getToken } from '../../lib/api';

export default function SavedPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdDetail[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api
      .saved()
      .then((rows) => setItems(rows.map((r) => r.ad)))
      .catch(console.error);
  }, [router]);

  return (
    <main className="container">
      <h1>المحفوظات</h1>
      <div className="stack">
        {items.map((ad) => (
          <Link key={ad.id} href={`/ads/${ad.id}`} className="panel">
            <strong>{ad.currentRevision?.title}</strong>
            <div className="muted">{ad.currentRevision?.city?.nameAr}</div>
          </Link>
        ))}
        {items.length === 0 ? <p className="muted">لا توجد إعلانات محفوظة.</p> : null}
      </div>
    </main>
  );
}
