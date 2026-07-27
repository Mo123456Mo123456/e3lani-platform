'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../../lib/api';

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!getToken()) return;
    api.adminPayments().then(setRows).catch(console.error);
  }, []);

  return (
    <div className="stack">
      <h2 style={{ marginTop: 0 }}>المدفوعات</h2>
      <p className="muted">المعاملات المؤكدة عبر Webhook فقط.</p>
      {rows.map((tx) => (
        <div key={tx.id} className="panel">
          <strong>{tx.provider}</strong> · {String(tx.amount)} {tx.currency}
          <div className="muted">
            {tx.status} · order {tx.orderId} · ref {tx.providerReference}
          </div>
        </div>
      ))}
      {rows.length === 0 ? <p className="muted">لا مدفوعات بعد.</p> : null}
    </div>
  );
}
