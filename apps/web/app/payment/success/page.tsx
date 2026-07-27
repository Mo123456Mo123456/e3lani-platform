'use client';

import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <main className="container">
      <div className="panel stack" style={{ maxWidth: 640 }}>
        <h1>صفحة النجاح</h1>
        <p className="error">
          هذا التحويل (Redirect) لا ينشر الإعلان. التفعيل يتم فقط بعد Webhook موقّع وتحقق خادمي.
        </p>
        <p className="muted">عد إلى حالة الإعلان وانتظر التفعيل بعد استلام Webhook.</p>
        <Link className="btn btn-primary" href="/account">
          إعلاناتي
        </Link>
      </div>
    </main>
  );
}
