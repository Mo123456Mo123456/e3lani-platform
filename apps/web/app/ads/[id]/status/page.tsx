'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdDetail } from '@e3lani/api-client';
import { api } from '../../../../lib/api';
import { statusLabel } from '../../../../lib/status';

export default function AdStatusPage() {
  const params = useParams<{ id: string }>();
  const [ad, setAd] = useState<AdDetail | null>(null);

  useEffect(() => {
    const load = () => api.getAd(params.id).then(setAd).catch(console.error);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [params.id]);

  if (!ad) return <main className="container"><p className="muted">جاري التحميل...</p></main>;

  const canPay = ad.status === 'APPROVED_AWAITING_PAYMENT' || ad.status === 'PAYMENT_FAILED';

  return (
    <main className="container">
      <div className="panel stack" style={{ maxWidth: 640 }}>
        <h1 style={{ margin: 0 }}>حالة الإعلان</h1>
        <p>{ad.currentRevision?.title}</p>
        <p className="badge">{statusLabel(ad.status)}</p>
        <p className="muted">المراجعة قبل الدفع. لن يظهر الدفع قبل قبول النسخة الحالية.</p>
        {ad.media?.[0]?.asset ? (
          <p>
            حالة الوسائط: <strong>{ad.media[0].asset.status}</strong>
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" href={`/ads/${ad.id}`}>
            عرض الإعلان
          </Link>
          {canPay ? (
            <Link className="btn btn-primary" href={`/ads/${ad.id}/pay`}>
              الدفع (19 ر.س)
            </Link>
          ) : null}
          {ad.status === 'ACTIVE' ? (
            <Link className="btn btn-primary" href="/browse">
              ظهور في التصفح
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
