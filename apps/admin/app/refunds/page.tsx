'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge, formatDate, formatMoney } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function RefundsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setOrders(await api.adminRefundOrders());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function refund(id: string) {
    await api.refundOrder(id, { reason: reason[id] || 'استرداد من لوحة الإدارة' });
    await load();
  }

  return (
    <div className="stack">
      <PageHeader title="الاستردادات" description="طلبات قابلة للاسترداد وحالات الاسترداد الحالية." />
      <ErrorMessage message={error} />
      {orders.map((order) => (
        <div key={order.id} className="panel stack">
          <div className="toolbar">
            <strong>{order.ad?.currentRevision?.title || order.id}</strong>
            <StatusBadge>{order.status}</StatusBadge>
            <StatusBadge>{formatMoney(order.total, order.currency)}</StatusBadge>
          </div>
          <div className="muted">
            {order.user?.displayName || order.user?.phone || order.userId} · {formatDate(order.updatedAt)}
          </div>
          <textarea
            className="textarea"
            placeholder="سبب الاسترداد"
            value={reason[order.id] ?? ''}
            onChange={(e) => setReason((current) => ({ ...current, [order.id]: e.target.value }))}
          />
          <button className="btn btn-primary" onClick={() => refund(order.id)} disabled={order.status !== 'PAID'}>
            تنفيذ استرداد كامل
          </button>
          {order.transactions?.length ? (
            <div className="json-box">
              {JSON.stringify(
                order.transactions.map((tx: any) => ({
                  provider: tx.provider,
                  status: tx.status,
                  amount: tx.amount,
                  ref: tx.providerReference,
                })),
                null,
                2,
              )}
            </div>
          ) : null}
        </div>
      ))}
      {orders.length === 0 && !error ? <EmptyState>لا توجد طلبات قابلة للاسترداد.</EmptyState> : null}
    </div>
  );
}
