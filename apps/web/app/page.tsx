import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container home-hero">
      <div className="stack" style={{ maxWidth: 760 }}>
        <div className="brand hero-brand">
          <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden>
            <path d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z" fill="#FFC400" />
            <path d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z" fill="#FFC400" opacity=".75" />
          </svg>
          <span className="brand-lockup">
            <strong>إعلاني | E3lani</strong>
            <small>منصة الإعلانات المرئية لكل شيء</small>
          </span>
        </div>
        <h1 className="hero-title">منصة الإعلانات المرئية لكل شيء</h1>
        <p className="muted hero-copy">
          انشر صورة أو فيديو، راجع مجانًا، وادفع 59 ر.س بعد القبول فقط. تواصل مباشر عبر المتجر أو واتساب.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/browse">
            ابدأ التصفح
          </Link>
          <Link className="btn btn-dark" href="/ads/new">
            أنشئ إعلانًا
          </Link>
          <Link className="btn btn-ghost" href="/login">
            دخول
          </Link>
        </div>
      </div>
    </main>
  );
}
