'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { BrandProfile } from '@e3lani/api-client';
import { api } from '../../../lib/api';

export default function BrandPage() {
  const params = useParams<{ slug: string }>();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .brand(params.slug)
      .then(setBrand)
      .catch((e) => setError((e as Error).message));
  }, [params.slug]);

  if (error) {
    return (
      <main className="container">
        <p className="error">{error}</p>
        <p className="muted">أنشئ ملف براند للمعلن لعرض هذه الصفحة.</p>
      </main>
    );
  }
  if (!brand) return <main className="container"><p className="muted">جاري التحميل...</p></main>;

  return (
    <main className="container stack">
      <div className="panel">
        <h1 style={{ marginTop: 0 }}>{brand.nameAr}</h1>
        {brand.isVerified ? <span className="badge">موثق</span> : null}
        <p className="muted">{brand.bio || 'صفحة براند إعلاني'}</p>
      </div>
      <div className="stack">
        {brand.ads.map((ad) => (
          <Link key={ad.id} href={`/ads/${ad.id}`} className="panel">
            {ad.currentRevision?.title}
          </Link>
        ))}
      </div>
    </main>
  );
}
