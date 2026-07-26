import Link from 'next/link';

export default function AdsReviewPage() {
  return (
    <main style={{ padding: 28 }}>
      <Link href="/">← لوحة الإدارة</Link>
      <h1>مراجعة الإعلانات</h1>
      <p style={{ color: '#777', maxWidth: 640, lineHeight: 1.7 }}>
        قارن الإصدارات والوسائط ونتائج الفحص. الحالات: PENDING_REVIEW → APPROVED_AWAITING_PAYMENT أو
        NEEDS_CHANGES أو REJECTED. الدفع لا يُعرض قبل الموافقة على النسخة الحالية.
      </p>
    </main>
  );
}
