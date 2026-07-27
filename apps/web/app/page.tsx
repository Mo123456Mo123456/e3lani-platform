import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container" style={{ paddingTop: '10vh' }}>
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="brand" style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)' }}>
          إعلاني
          <svg width="48" height="48" viewBox="0 0 64 64" aria-hidden>
            <path d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z" fill="#FFC400" />
            <path d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z" fill="#FFC400" opacity=".75" />
          </svg>
        </div>
        <p className="muted" style={{ margin: 0 }}>E3lani</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', lineHeight: 1.4 }}>
          منصة الإعلانات المرئية لكل شيء
        </h1>
        <p className="muted" style={{ lineHeight: 1.7, maxWidth: '36ch' }}>
          انشر صورة أو فيديو، راجع مجانًا، وادفع 59 ر.س بعد القبول فقط. تواصل مباشر عبر المتجر أو واتساب.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/browse">
            ابدأ التصفح
          </Link>
          <Link className="btn btn-dark" href="/ads/new">
            أنشئ إعلانًا
          </Link>
          <Link className="btn btn-ghost" href="/login">
            دخول OTP
          </Link>
        </div>
      </div>
    </main>
  );
}
