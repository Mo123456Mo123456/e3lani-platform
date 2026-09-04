'use client';

import { useState } from 'react';
import { api, download, type Vehicle, type Worker } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  StatusPill,
  fmtDateTime,
  fmtRelative,
  useData,
} from '@/components/ui';

interface Device {
  id: string;
  deviceUid: string;
  platform: string | null;
  model: string | null;
  appVersion: string | null;
  status: string;
  lastSeenAt: string | null;
  workerName: string | null;
  vehicleNo: string | null;
}

interface ActivationCode {
  id: string;
  code: string;
  workerName: string;
  vehicleNo: string;
  expiresAt: string;
  consumedAt: string | null;
  activationPayload: string;
}

export default function DevicesPage() {
  const devices = useData<{ items: Device[] }>(() => api('/v1/devices'));
  const codes = useData<{ items: ActivationCode[] }>(() => api('/v1/devices/activation-codes'));
  const workers = useData<{ items: Worker[] }>(() => api('/v1/workers'));
  const vehicles = useData<{ items: Vehicle[] }>(() => api('/v1/vehicles'));
  const [creating, setCreating] = useState(false);

  const revoke = async (d: Device) => {
    if (!confirm(`إلغاء تفعيل جهاز ${d.workerName ?? d.deviceUid}؟ سيتوقف عن التسجيل فورًا.`)) {
      return;
    }
    try {
      await api(`/v1/devices/${d.id}/revoke`, { method: 'POST' });
      devices.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Shell title="أجهزة العمال والتفعيل">
      <div className="alert info">
        <span>📱</span>
        <div>
          العامل لا يسجّل دخولًا يوميًا. أنشئ كود تفعيل مرة واحدة، يمسحه من التطبيق، فيُربط
          جهازه بالعامل والسيارة. بعدها يفتح التطبيق مباشرة على شاشة المسح.
        </div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + كود تفعيل
        </button>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>أكواد التفعيل</h2>
        </div>
        {codes.error != null ? (
          <div style={{ padding: 16 }}>
            <ErrorBox error={codes.error} onRetry={codes.reload} />
          </div>
        ) : codes.loading ? (
          <div style={{ padding: 16 }}>
            <Loading rows={3} />
          </div>
        ) : !codes.data || codes.data.items.length === 0 ? (
          <Empty icon="🔑" title="لا توجد أكواد" hint="أنشئ كودًا لربط جهاز عامل بالنظام" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>العامل</th>
                  <th>السيارة</th>
                  <th>الصلاحية</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.data.items.map((c) => {
                  const expired = !c.consumedAt && new Date(c.expiresAt).getTime() < Date.now();
                  return (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                        {c.consumedAt ? '••••-••••' : c.code}
                      </td>
                      <td>{c.workerName}</td>
                      <td>{c.vehicleNo}</td>
                      <td className="hint">{fmtDateTime(c.expiresAt)}</td>
                      <td>
                        {c.consumedAt ? (
                          <span className="pill ok">مُستخدم</span>
                        ) : expired ? (
                          <span className="pill muted">منتهي</span>
                        ) : (
                          <span className="pill warn">بانتظار المسح</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        {!c.consumedAt && !expired && (
                          <button
                            className="btn sm"
                            onClick={() =>
                              download(
                                `/v1/devices/activation-codes/${c.id}.pdf`,
                                `vero-activation-${c.code}.pdf`,
                              )
                            }
                          >
                            ورقة التفعيل PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>الأجهزة المُفعَّلة</h2>
        </div>
        {devices.error != null ? (
          <div style={{ padding: 16 }}>
            <ErrorBox error={devices.error} onRetry={devices.reload} />
          </div>
        ) : devices.loading ? (
          <div style={{ padding: 16 }}>
            <Loading rows={3} />
          </div>
        ) : !devices.data || devices.data.items.length === 0 ? (
          <Empty icon="📱" title="لا توجد أجهزة مفعّلة بعد" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>العامل</th>
                  <th>السيارة</th>
                  <th>الجهاز</th>
                  <th>النظام</th>
                  <th>الإصدار</th>
                  <th>آخر نشاط</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {devices.data.items.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.workerName ?? '— غير مرتبط —'}</td>
                    <td>{d.vehicleNo ?? '—'}</td>
                    <td className="mono hint">{d.model ?? d.deviceUid.slice(0, 14)}</td>
                    <td className="hint">{d.platform ?? '—'}</td>
                    <td className="mono hint">{d.appVersion ?? '—'}</td>
                    <td className="hint">{fmtRelative(d.lastSeenAt)}</td>
                    <td>
                      <StatusPill status={d.status} />
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      {d.status === 'ACTIVE' && (
                        <button className="btn sm danger" onClick={() => revoke(d)}>
                          إلغاء التفعيل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && (
        <CreateCode
          workers={workers.data?.items ?? []}
          vehicles={vehicles.data?.items ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            codes.reload();
          }}
        />
      )}
    </Shell>
  );
}

function CreateCode({
  workers,
  vehicles,
  onClose,
  onDone,
}: {
  workers: Worker[];
  vehicles: Vehicle[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [workerId, setWorkerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [ttlHours, setTtl] = useState(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<ActivationCode | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<ActivationCode>('/v1/devices/activation-codes', {
        method: 'POST',
        body: { workerId, vehicleId, ttlHours },
      });
      setCreated(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="كود تفعيل جهاز"
      onClose={onClose}
      footer={
        created ? (
          <>
            <button
              className="btn primary"
              onClick={() =>
                download(
                  `/v1/devices/activation-codes/${created.id}.pdf`,
                  `vero-activation-${created.code}.pdf`,
                )
              }
            >
              تنزيل ورقة التفعيل PDF
            </button>
            <button className="btn" onClick={onDone}>
              تم
            </button>
          </>
        ) : (
          <>
            <button
              className="btn primary"
              onClick={create}
              disabled={busy || !workerId || !vehicleId}
            >
              {busy ? 'جارٍ الإنشاء…' : 'إنشاء الكود'}
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>
              إلغاء
            </button>
          </>
        )
      }
    >
      {error != null && <ErrorBox error={error} />}

      {created ? (
        <>
          <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
            <div className="hint">كود التفعيل — يُستخدم مرة واحدة فقط</div>
            <div
              className="mono"
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: 3,
                color: 'var(--primary)',
                marginTop: 6,
              }}
            >
              {created.code}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              {created.workerName} · السيارة {created.vehicleNo}
            </div>
            <div className="hint">صالح حتى {fmtDateTime(created.expiresAt)}</div>
          </div>
          <div className="alert warn">
            <span>🔒</span>
            <div>
              لا تشارك هذا الكود عبر قنوات عامة. أول جهاز يمسحه يُربط بالعامل والسيارة،
              وأي محاولة لاحقة تُرفض.
            </div>
          </div>
        </>
      ) : (
        <>
          <Field label="العامل" required>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">— اختر العامل —</option>
              {workers
                .filter((w) => w.status === 'ACTIVE')
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.fullName} ({w.employeeNo})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="السيارة" required>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">— اختر السيارة —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.internalNo} {v.name ? `— ${v.name}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مدة صلاحية الكود (ساعات)" hint="بعدها يصبح الكود غير صالح ويلزم إنشاء غيره">
            <input
              type="number"
              min={1}
              max={720}
              value={ttlHours}
              onChange={(e) => setTtl(Number(e.target.value) || 72)}
            />
          </Field>
        </>
      )}
    </Modal>
  );
}
