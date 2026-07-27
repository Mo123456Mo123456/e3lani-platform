'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../../lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    if (!getToken()) return;
    api.adminOrders().then(setOrders).catch(console.error);
  }, []);

  return (
    <div className="stack">
      <h2 style={{ marginTop: 0 }}>الطلبات</h2>
      {orders.map((order) => (
        <div key={order.id} className="panel">
          <strong>{order.id}</strong>
          <div className="muted">
            {order.status} · {String(order.total)} {order.currency} · {order.ad?.currentRevision?.title}
          </div>
        </div>
      ))}
      {orders.length === 0 ? <p className="muted">لا طلبات بعد.</p> : null}
    </div>
  );
}
