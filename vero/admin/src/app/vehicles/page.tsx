'use client';

import { useState } from 'react';
import { api, type Vehicle, type Worker } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  StatusPill,
  fmtRelative,
  useData,
} from '@/components/ui';

export default function VehiclesPage() {
  const list = useData<{ items: Vehicle[] }>(() => api('/v1/vehicles'));
  const workers = useData<{ items: Worker[] }>(() => api('/v1/workers'));
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Shell title="السيارات">
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + سيارة جديدة
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
          <Empty icon="🚛" title="لا توجد سيارات" hint="أضف سيارات الشركة لتتمكن من ربط العمال بها" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الرقم الداخلي</th>
                  <th>الاسم</th>
                  <th>اللوحة</th>
                  <th>النوع</th>
                  <th>السائق الحالي</th>
                  <th>تم اليوم</th>
                  <th>آخر اتصال</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.internalNo}</td>
                    <td>{v.name ?? '—'}</td>
                    <td className="mono">{v.plateNo ?? '—'}</td>
                    <td>{v.vehicleType ?? '—'}</td>
                    <td>{v.currentWorkerName ?? '—'}</td>
                    <td className="num">{v.doneToday ?? 0}</td>
                    <td className="hint">{fmtRelative(v.lastSeenAt)}</td>
                    <td>
                      <StatusPill status={v.status} />
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <button className="btn sm" onClick={() => setEditing(v)}>
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
        <VehicleForm
          vehicle={editing}
          workers={workers.data?.items ?? []}
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

function VehicleForm({
  vehicle,
  workers,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle | null;
  workers: Worker[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    internalNo: vehicle?.internalNo ?? '',
    name: vehicle?.name ?? '',
    plateNo: vehicle?.plateNo ?? '',
    vehicleType: vehicle?.vehicleType ?? '',
    status: (vehicle?.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
    currentWorkerId: vehicle?.currentWorkerId ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        internalNo: form.internalNo,
        name: form.name || null,
        plateNo: form.plateNo || null,
        vehicleType: form.vehicleType || null,
        status: form.status,
      };
      let id = vehicle?.id;
      if (vehicle) await api(`/v1/vehicles/${vehicle.id}`, { method: 'PATCH', body });
      else id = (await api<Vehicle>('/v1/vehicles', { method: 'POST', body })).id;

      if (id && form.currentWorkerId !== (vehicle?.currentWorkerId ?? '')) {
        await api(`/v1/vehicles/${id}/assign`, {
          method: 'POST',
          body: { workerId: form.currentWorkerId || null },
        });
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!vehicle) return;
    if (!confirm(`حذف السيارة ${vehicle.internalNo}؟`)) return;
    setBusy(true);
    try {
      await api(`/v1/vehicles/${vehicle.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={vehicle ? `السيارة ${vehicle.internalNo}` : 'سيارة جديدة'}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={busy || !form.internalNo}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <div style={{ flex: 1 }} />
          {vehicle && (
            <button className="btn danger" onClick={remove} disabled={busy}>
              حذف
            </button>
          )}
        </>
      }
    >
      {error != null && <ErrorBox error={error} />}

      <div className="row2">
        <Field label="الرقم الداخلي" required>
          <input
            value={form.internalNo}
            onChange={(e) => setForm({ ...form, internalNo: e.target.value })}
            placeholder="07"
          />
        </Field>
        <Field label="اسم السيارة">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>

      <div className="row2">
        <Field label="رقم اللوحة">
          <input
            value={form.plateNo}
            onChange={(e) => setForm({ ...form, plateNo: e.target.value })}
          />
        </Field>
        <Field label="النوع">
          <input
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            placeholder="ضاغط / قلاب"
          />
        </Field>
      </div>

      <div className="row2">
        <Field label="السائق الحالي">
          <select
            value={form.currentWorkerId}
            onChange={(e) => setForm({ ...form, currentWorkerId: e.target.value })}
          >
            <option value="">— بلا سائق —</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.fullName} ({w.employeeNo})
              </option>
            ))}
          </select>
        </Field>
        <Field label="الحالة">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          >
            <option value="ACTIVE">فعّالة</option>
            <option value="MAINTENANCE">صيانة</option>
            <option value="INACTIVE">موقوفة</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
