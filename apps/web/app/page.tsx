import Link from 'next/link';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M10 48C18 34 28 22 42 10L50 18C38 28 28 38 20 52L10 48Z"
        fill="#FFC400"
      />
      <path
        d="M22 50C28 40 36 30 48 20L54 26C44 34 36 42 30 52L22 50Z"
        fill="#FFC400"
        opacity="0.75"
      />
      <path d="M42 8L54 12L48 22L42 8Z" fill="#FFC400" />
      <path d="M50 18L58 22L54 30L50 18Z" fill="#FFC400" opacity="0.85" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <div className="visual-plane" />
      <main className="hero">
        <header className="nav">
          <nav className="nav-links" aria-label="Primary">
            <Link href="/browse">تصفح</Link>
            <Link href="/pricing">الأسعار</Link>
            <Link href="/en">English</Link>
          </nav>
          <div className="brand">
            <div>
              <div className="brand-name">إعلاني</div>
              <div className="brand-en">E3lani</div>
            </div>
            <BrandMark />
          </div>
        </header>

        <section className="hero-main">
          <h1 className="headline">منصة الإعلانات المرئية لكل شيء</h1>
          <p className="sub">
            انشر صورة أو فيديو، راجع مجانًا، وادفع بعد القبول فقط. تواصل مباشر عبر المتجر أو واتساب أو الاتصال.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/browse">
              ابدأ التصفح
            </Link>
            <Link className="btn btn-ghost" href="/pricing">
              الأسعار من 59 ر.س
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
