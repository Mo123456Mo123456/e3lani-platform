'use client';

import * as React from 'react';
import { halalasToSar } from '@e3lani/config';
import { Badge, Button, Card, Input, Select, Textarea, formatNumber } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { DataTable, type Column } from '@/components/data-table';
import { adminFetch } from '@/lib/admin-api';

interface PaymentRow {
  id: string;
  amountHalalas: number;
  status: string;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string | null; phone: string };
  ad: { id: string; title: string } | null;
}

interface PaymentDetails {
  payment: PaymentRow & { invoice: { number: string; totalHalalas: number } | null };
  attempts: { id: string; status: string; provider: string; errorMessage: string | null; createdAt: string }[];
  refunds: { id: string; amountHalalas: number; status: string; reason: string; createdAt: string }[];
  refundableHalalas: number;
}

export default function AdminPaymentsPage() {
  const canRefund = useCan('payments.refund');
  const [rows, setRows] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('');
  const [details, setDetails] = React.useState<PaymentDetails | null>(null);
  const [refundForm, setRefundForm] = React.useState({ sar: '', reason: '' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    void adminFetch<{ items: PaymentRow[] }>(`/admin/payments?limit=25${status ? `&status=${status}` : ''}`)
      .then((page) => setRows(page.items))
      .finally(() => setLoading(false));
  }, [status]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openDetails = async (id: string) => {
    setError(null);
    setRefundForm({ sar: '', reason: '' });
    setDetails(await adminFetch<PaymentDetails>(`/admin/payments/${id}`));
  };

  const submitRefund = async () => {
    if (!details) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/payments/${details.payment.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amountHalalas: refundForm.sar ? Math.round(Number(refundForm.sar) * 100) : undefined,
          reason: refundForm.reason,
        }),
      });
      await openDetails(details.payment.id);
      load();
    } catch (err: any) {
      setError(err.message ?? 'تعذّر الاسترداد');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<PaymentRow>[] = [
    {
      key: 'amount',
      header: 'المبلغ',
      render: (row) => <span className="font-bold">{formatNumber(halalasToSar(row.amountHalalas))} ر.س</span>,
    },
    {
      key: 'user',
      header: 'العميل',
      render: (row) => (
        <div>
          <p>{row.user?.name ?? '—'}</p>
          <p className="text-xs text-ink-muted">{row.user?.phone}</p>
        </div>
      ),
    },
    { key: 'ad', header: 'الإعلان', render: (row) => row.ad?.title ?? '—' },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge tone={row.status === 'PAID' ? 'success' : row.status === 'FAILED' ? 'danger' : 'neutral'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'provider',
      header: 'المزوّد',
      render: (row) => (
        <div className="text-xs">
          <p>{row.provider}</p>
          <p className="text-ink-muted">{row.providerRef ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (row) => (
        <span className="text-xs">{new Date(row.createdAt).toLocaleString('ar-SA')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => void openDetails(row.id)}>
          تفاصيل
        </Button>
      ),
    },
  ];

  return (
    <AdminShell title="المدفوعات">
      <div className="mb-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[200px]">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد الانتظار</option>
          <option value="PAID">مدفوعة</option>
          <option value="FAILED">فاشلة</option>
          <option value="REFUNDED">مستردة</option>
        </Select>
      </div>
      <DataTable rows={rows} columns={columns} loading={loading} emptyTitle="لا توجد عمليات دفع" />

      {details ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-extrabold">تفاصيل العملية</h2>
              <button onClick={() => setDetails(null)} className="text-sm font-bold text-ink-muted">
                إغلاق
              </button>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">المبلغ</dt>
                <dd className="font-bold">{halalasToSar(details.payment.amountHalalas)} ر.س</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">الحالة</dt>
                <dd>{details.payment.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">الفاتورة</dt>
                <dd>{details.payment.invoice?.number ?? 'لم تُصدر'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">القابل للاسترداد</dt>
                <dd className="font-bold">{halalasToSar(details.refundableHalalas)} ر.س</dd>
              </div>
            </dl>

            <section>
              <h3 className="mb-1 text-sm font-bold">محاولات البوابة</h3>
              <ul className="space-y-1 text-xs text-ink-muted">
                {details.attempts.map((attempt) => (
                  <li key={attempt.id} className="flex justify-between gap-2">
                    <span>{attempt.status}</span>
                    <span>{attempt.errorMessage ?? attempt.provider}</span>
                    <span>{new Date(attempt.createdAt).toLocaleTimeString('ar-SA')}</span>
                  </li>
                ))}
                {!details.attempts.length ? <li>لا توجد محاولات مسجّلة</li> : null}
              </ul>
            </section>

            <section>
              <h3 className="mb-1 text-sm font-bold">الاستردادات</h3>
              <ul className="space-y-1 text-xs">
                {details.refunds.map((refund) => (
                  <li key={refund.id} className="flex justify-between gap-2">
                    <span className="font-semibold">{halalasToSar(refund.amountHalalas)} ر.س</span>
                    <span className="text-ink-muted">{refund.reason}</span>
                    <Badge tone={refund.status === 'COMPLETED' ? 'success' : 'danger'}>
                      {refund.status}
                    </Badge>
                  </li>
                ))}
                {!details.refunds.length ? <li className="text-ink-muted">لا توجد استردادات</li> : null}
              </ul>
            </section>

            {canRefund && details.refundableHalalas > 0 ? (
              <section className="space-y-2 border-t border-line pt-3">
                <h3 className="text-sm font-bold">تنفيذ استرداد</h3>
                <Input
                  label={`المبلغ (ريال) — اتركه فارغًا لاسترداد ${halalasToSar(details.refundableHalalas)} كاملة`}
                  type="number"
                  min={0}
                  value={refundForm.sar}
                  onChange={(event) => setRefundForm({ ...refundForm, sar: event.target.value })}
                />
                <Textarea
                  label="السبب"
                  value={refundForm.reason}
                  onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <Button loading={busy} onClick={() => void submitRefund()}>
                  تنفيذ الاسترداد
                </Button>
              </section>
            ) : null}
          </Card>
        </div>
      ) : null}
    </AdminShell>
  );
}
