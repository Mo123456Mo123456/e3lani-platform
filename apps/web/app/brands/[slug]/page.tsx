'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type BrandPayload = {
  id: string;
  slug: string;
  nameAr: string;
  bio?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  websiteUrl?: string | null;
  storeUrl?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  isVerified?: boolean;
  viewCount?: number;
  ads: Array<{ id: string; currentRevision?: { title?: string } | null }>;
  posts?: Array<{ id: string; title: string; description?: string | null }>;
};

export default function BrandPage() {
  const params = useParams<{ slug: string }>();
  const [brand, setBrand] = useState<BrandPayload | null>(null);
  const [tab, setTab] = useState<'ads' | 'posts'>('ads');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .brand(params.slug)
      .then((data) => setBrand(data as unknown as BrandPayload))
      .catch((e) => setError((e as Error).message));
  }, [params.slug]);

  if (error) {
    return (
      <main className="container">
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!brand) {
    return (
      <main className="container">
        <p className="muted">جاري التحميل...</p>
      </main>
    );
  }

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      await navigator.share({ title: brand!.nameAr, url });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <main className="container stack">
      <div className="panel stack">
        {brand.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.coverUrl}
            alt=""
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12 }}
          />
        ) : null}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12 }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                background: '#FFC400',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 28,
              }}
            >
              {brand.nameAr.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0 }}>
              {brand.nameAr} {brand.isVerified ? <span className="badge">موثق</span> : null}
            </h1>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {brand.bio || 'صفحة معلن على إعلاني'}
            </p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              المشاهدات: {brand.viewCount ?? 0}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {brand.whatsapp ? (
            <a className="btn btn-primary" href={`https://wa.me/${brand.whatsapp.replace(/\D/g, '')}`}>
              واتساب
            </a>
          ) : null}
          {brand.phone ? (
            <a className="btn btn-ghost" href={`tel:${brand.phone}`}>
              اتصال
            </a>
          ) : null}
          {brand.storeUrl || brand.websiteUrl ? (
            <a
              className="btn btn-ghost"
              href={brand.storeUrl || brand.websiteUrl || '#'}
              target="_blank"
              rel="noreferrer"
            >
              المتجر
            </a>
          ) : null}
          <button className="btn btn-ghost" type="button" onClick={share}>
            مشاركة
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={tab === 'ads' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => setTab('ads')}
        >
          الإعلانات
        </button>
        <button
          className={tab === 'posts' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => setTab('posts')}
        >
          المنشورات
        </button>
      </div>

      {tab === 'ads' ? (
        <div className="stack">
          {brand.ads.length === 0 ? <p className="muted">لا توجد إعلانات نشطة.</p> : null}
          {brand.ads.map((ad) => (
            <Link key={ad.id} href={`/ads/${ad.id}`} className="panel">
              {ad.currentRevision?.title || 'إعلان'}
            </Link>
          ))}
        </div>
      ) : (
        <div className="stack">
          {(brand.posts ?? []).length === 0 ? (
            <p className="muted">لا توجد منشورات. المنشورات تظهر هنا فقط وليس في موجز الإعلانات.</p>
          ) : null}
          {(brand.posts ?? []).map((post) => (
            <div key={post.id} className="panel">
              <strong>{post.title}</strong>
              {post.description ? <p className="muted">{post.description}</p> : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
