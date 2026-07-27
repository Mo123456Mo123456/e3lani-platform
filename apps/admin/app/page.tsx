'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api';

export default function AdminHome() {
  const [pending, setPending] = useState(0);
  const [payments, setPayments] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    Promise.all([api.adminReviewQueue(), api.adminPayments()])
      .then(([queue, txs]) => {
        setPending(queue.length);
        setPayments(txs.length);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="stack">
      <h2 style={{ marginTop: 0 }}>لوحة المتابعة</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <div className="panel"><strong style={{ fontSize: 28 }}>{pending}</strong><div className="muted">بانتظار المراجعة</div></div>
        <div className="panel"><strong style={{ fontSize: 28 }}>{payments}</strong><div className="muted">معاملات الدفع</div></div>
        <div className="panel"><strong style={{ fontSize: 28 }}>Sandbox</strong><div className="muted">وضع الدفع</div></div>
      </div>
    </div>
  );
}
