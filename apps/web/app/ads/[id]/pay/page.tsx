'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PaymentOptions } from '@e3lani/api-client';
import { api, getToken } from '../../../../lib/api';

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    api
      .paymentOptions(params.id)
      .then(setOptions)
      .catch((e) => setError((e as Error).message));
  }, [params.id, router]);

  async function checkout() {
    setBusy(true);
    setError('');
    try {
      const res = await api.createOrder(params.id, `web_${params.id}_${Date.now()}`, {
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/payment/cancel`,
      });
      if (res.checkout.checkoutUrl) {
        window.location.href = res.checkout.checkoutUrl;
        return;
      }
      throw new Error('لا يوجد رابط دفع');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="panel stack" style={{ maxWidth: 560 }}>
        <h1 style={{ margin: 0 }}>الدفع</h1>
        <p className="muted">يظهر الدفع فقط بعد قبول المراجعة. صفحة النجاح لا تفعّل الإعلان.</p>
        {options ? (
          <>
            <p className="muted">
              الصافي: {options.quote.subtotal} {options.quote.currency}
              {options.quote.taxAmount > 0
                ? ` · الضريبة: ${options.quote.taxAmount} ${options.quote.currency}`
                : ''}
            </p>
            <p>
              الإجمالي المستحق: <strong>{options.quote.total} {options.quote.currency}</strong>
              {options.quote.taxMode === 'inclusive' ? ' (شامل الضريبة)' : ''}
            </p>
            <p className="muted">
              المزود: {options.routing.ok ? options.routing.provider?.name : options.messageAr}
            </p>
            <button className="btn btn-primary" disabled={busy || !options.routing.ok} onClick={checkout}>
              ادفع عبر Sandbox
            </button>
          </>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
