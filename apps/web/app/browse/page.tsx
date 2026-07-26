import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'تصفح | إعلاني',
  description: 'تصفح الإعلانات المرئية',
  robots: { index: true, follow: true },
};

export default function BrowsePage() {
  return (
    <main style={{ padding: '40px 24px', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/" style={{ fontWeight: 700 }}>
        ← إعلاني
      </Link>
      <h1 style={{ marginTop: 24 }}>التصفح</h1>
      <p style={{ color: '#777', lineHeight: 1.7 }}>
        واجهة التصفح العامة تتصل بـ <code>/api/v1/feed</code>. المسودات والمرفوض والمحذوف وصفحات الدفع لا تُفهرس.
      </p>
    </main>
  );
}
