'use client';

import { DEFAULT_SA_PRICING } from '@e3lani/types';
import Link from 'next/link';
import { useLocale } from '../lib/locale';

export default function HomePage() {
  const { locale, tr } = useLocale();
  const isAr = locale === 'ar';
  const publishPrice = DEFAULT_SA_PRICING.AD_PUBLISH_30D;

  return (
    <main className="container">
      <section className="home-hero">
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="brand hero-brand">
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden>
            <path d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z" fill="#FFC400" />
            <path d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z" fill="#FFC400" opacity=".75" />
          </svg>
          <span className="brand-lockup">
            <strong>إعلاني | E3lani</strong>
            <small>{tr('brand.tagline')}</small>
          </span>
        </div>
        <h1 className="hero-title">{tr('brand.tagline')}</h1>
        <p className="muted hero-copy">
          {isAr
            ? `انشر صورة أو فيديو، راجع مجانًا، وادفع ${publishPrice.amount} ${publishPrice.currency} بعد القبول فقط. تواصل مباشر عبر المتجر أو واتساب.`
            : `Publish a photo or video, get free review, and pay ${publishPrice.amount} ${publishPrice.currency} only after approval. Direct contact via store or WhatsApp.`}
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/browse">
            {isAr ? 'ابدأ التصفح' : 'Start browsing'}
          </Link>
          <Link className="btn btn-dark" href="/ads/new">
            {isAr ? 'أنشئ إعلانًا' : 'Create an ad'}
          </Link>
          <Link className="btn btn-ghost" href="/login" style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
            {isAr ? 'دخول' : 'Login'}
          </Link>
        </div>
      </div>
      </section>
    </main>
  );
}
