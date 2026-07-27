import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container stack">
      <section className="panel stack">
        <span className="badge">404</span>
        <h1 style={{ margin: 0 }}>الصفحة غير موجودة</h1>
        <p className="muted" style={{ margin: 0 }}>
          لم نتمكن من العثور على الصفحة المطلوبة في إعلاني.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/browse">
            التصفح
          </Link>
          <Link className="btn btn-ghost" href="/search">
            البحث
          </Link>
        </div>
      </section>
    </main>
  );
}
