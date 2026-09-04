'use client';

import { useState } from 'react';
import { api, type Vehicle, type Worker } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { Empty, ErrorBox, Field, Loading, Modal, StatusPill, useData } from '@/components/ui';

export default function WorkersPage() {
  const list = useData<{ items: Worker[] }>(() => api('/v1/workers'));
  const vehicles = useData<{ items: Vehicle[] }>(() => api('/v1/vehicles'));
  const [editing, setEditing] = useState<Worker | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Shell title="العمال والسائقون">
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + عامل جديد
        </button>
      </div>

      <section className="card">
        {list.error != null ? (
          <div style={{ padding: 16 }}>
            <ErrorBox error={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading ? (
          <div style={{ padding: 16 }}>
            <Loading rows={5} />
          </div>
        ) : !list.data || list.data.items.length === 0 ? (
          <Empty
            icon="👷"
            title="لا يوجد عمال"
            hint="أضف العمال ثم أنشئ لهم أكواد تفعيل من صفحة الأجهزة"
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الرقم الوظيفي</th>
                  <th>الجوال</th>
                  <th>السيارة المرتبطة</th>
                  <th>تم اليوم</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600 }}>{w.fullName}</td>
                    <td className="mono">{w.employeeNo}</td>
                    <td className="mono">{w.phone ?? '—'}</td>
                    <td>{w.defaultVehicleNo ?? '—'}</td>
                    <td className="num">{w.doneToday ?? 0}</td>
                    <td>
                      <StatusPill status={w.status} />
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <button className="btn sm" onClick={() => setEditing(w)}>
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(creating || editing) && (
        <WorkerForm
          worker={editing}
          vehicles={vehicles.data?.items ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </Shell>
  );
}

function WorkerForm({
  worker,
  vehicles,
  onClose,
  onSaved,
}: {
  worker: Worker | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: worker?.fullName ?? '',
    employeeNo: worker?.employeeNo ?? '',
    phone: worker?.phone ?? '',
    status: (worker?.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    defaultVehicleId: worker?.defaultVehicleId ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        fullName: form.fullName,
        employeeNo: form.employeeNo,
        phone: form.phone || null,
        status: form.status,
        defaultVehicleId: form.defaultVehicleId || null,
      };
      if (worker) await api(`/v1/workers/${worker.id}`, { method: 'PATCH', body });
      else await api('/v1/workers', { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!worker) return;
    if (!confirm(`حذف العامل ${worker.fullName}؟`)) return;
    setBusy(true);
    try {
      await api(`/v1/workers/${worker.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={worker ? worker.fullName : 'عامل جديد'}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || !form.fullName || !form.employeeNo}
          >
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <div style={{ flex: 1 }} />
          {worker && (
            <button className="btn danger" onClick={remove} disabled={busy}>
              حذف
            </button>
          )}
        </>
      }
    >
      {error != null && <ErrorBox error={error} />}

      <Field label="الاسم الكامل" required>
        <input
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
      </Field>

      <div className="row2">
        <Field label="الرقم الوظيفي" required>
          <input
            value={form.employeeNo}
            onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
            placeholder="E-1001"
          />
        </Field>
        <Field label="الجوال">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            dir="ltr"
          />
        </Field>
      </div>

      <div className="row2">
        <Field label="السيارة المرتبطة">
          <select
            value={form.defaultVehicleId}
            onChange={(e) => setForm({ ...form, defaultVehicleId: e.target.value })}
          >
            <option value="">— بلا سيارة —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.internalNo} {v.name ? `— ${v.name}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الحالة">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          >
            <option value="ACTIVE">فعّال</option>
            <option value="INACTIVE">موقوف</option>
          </select>
        </Field>
      </div>

      <div className="alert info">
        <span>ℹ</span>
        <div>
          إيقاف العامل يمنع جهازه من تسجيل أي زيارة فورًا، دون حذف سجلّه أو زياراته السابقة.
        </div>
      </div>
    </Modal>
  );
}
