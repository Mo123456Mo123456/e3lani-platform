import { DEFAULT_SA_PRICING } from '@e3lani/types';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'الأسعار | إعلاني',
  description: 'تسعير نشر الإعلانات المرئية في السعودية',
};

export default function PricingPage() {
  const items = Object.values(DEFAULT_SA_PRICING);

  return (
    <main style={{ padding: '40px 24px', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/" style={{ fontWeight: 700 }}>
        ← إعلاني
      </Link>
      <h1 style={{ marginTop: 24 }}>الأسعار في السعودية</h1>
      <p style={{ color: '#777' }}>الأسعار تُدار من الخادم وإصدارات التسعير — لا تُثبَّت داخل التطبيقات.</p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <li
            key={item.labelAr}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              padding: '16px 18px',
              background: '#F7F7F7',
              borderRadius: 14,
            }}
          >
            <strong>
              {item.amount} {item.currency}
            </strong>
            <span>{item.labelAr}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
