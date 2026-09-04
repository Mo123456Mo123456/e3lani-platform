'use client';

import { useRef, useState } from 'react';
import { api, download, type BackupItem } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty, ErrorBox, Loading, Modal, StatusPill, fmtBytes, fmtDateTime, useData,
} from '@/components/ui';

export default function BackupsPage() {
  const list = useData<{ items: BackupItem[] }>(() => api('/v1/backups'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const create = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await api<{ filename: string; sizeBytes: number }>('/v1/backups', { method: 'POST' });
      setNotice(`تم إنشاء النسخة ${res.filename} بحجم ${fmtBytes(res.sizeBytes)}.`);
      list.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const remove = async (b: BackupItem) => {
    if (!confirm(`حذف النسخة ${b.filename} نهائيًا؟`)) return;
    try {
      await api(`/v1/backups/${b.id}`, { method: 'DELETE' });
      list.reload();
    } catch (err) { setError(err); }
  };

  return (
    <Shell title="النسخ الاحتياطي والاستعادة">
      <div className="alert info">
        <span>💾</span>
        <div>
          النسخة ملف JSON مضغوط يحوي <b>كل بيانات شركتك</b>: الحاويات، الرموز، الزيارات،
          المسارات، التقارير، وسجل العمليات. الملف ملكك بالكامل ولا يُرسل لأي جهة خارجية.
        </div>
      </div>

      {error != null && <ErrorBox error={error} />}
      {notice && <div className="alert ok"><span>✓</span><div>{notice}</div></div>}

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setRestoring(true)}>استعادة من ملف</button>
        <button className="btn primary" onClick={create} disabled={busy}>
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء نسخة الآن'}
        </button>
      </div>

      <section className="card">
        {list.error != null ? (
          <div style={{ padding: 16 }}><ErrorBox error={list.error} onRetry={list.reload} /></div>
        ) : list.loading ? (
          <div style={{ padding: 16 }}><Loading rows={4} /></div>
        ) : !list.data || list.data.items.length === 0 ? (
          <Empty icon="💾" title="لا توجد نسخ احتياطية" hint="أنشئ نسخة الآن، ويُنصح بجدولة نسخة يومية" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الملف</th><th>الحجم</th><th>النوع</th>
                  <th>التاريخ</th><th>أنشأها</th><th>الحالة</th><th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((b) => (
                  <tr key={b.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{b.filename}</td>
                    <td className="num">{fmtBytes(b.sizeBytes)}</td>
                    <td>{b.kind === 'AUTO' ? 'تلقائية' : 'يدوية'}</td>
                    <td className="hint">{fmtDateTime(b.createdAt)}</td>
                    <td className="hint">{b.createdByName ?? 'النظام'}</td>
                    <td>
                      <StatusPill status={b.status} />
                      {!b.available && b.status === 'READY' && (
                        <span className="pill bad" style={{ marginInlineStart: 5 }}>الملف مفقود</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {b.available && (
                        <button className="btn sm" onClick={() => download(`/v1/backups/${b.id}/download`, b.filename)}>
                          تنزيل
                        </button>
                      )}{' '}
                      <button className="btn sm" onClick={() => remove(b)}>حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {restoring && (
        <RestoreModal onClose={() => setRestoring(false)} onDone={() => { setRestoring(false); list.reload(); }} />
      )}
    </Shell>
  );
}

function RestoreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<{ restored: Record<string, number>; backupCreatedAt: string } | null>(null);

  const run = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError(new Error('اختر ملف النسخة الاحتياطية أولًا')); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api<typeof result>('/v1/backups/restore', { method: 'POST', body: fd });
      setResult(res);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <Modal
      title="استعادة نسخة احتياطية"
      onClose={onClose}
      footer={
        result ? (
          <button className="btn primary" onClick={() => window.location.reload()}>إعادة تحميل اللوحة</button>
        ) : (
          <>
            <button className="btn danger" onClick={run} disabled={busy || confirmText !== 'استعادة'}>
              {busy ? 'جارٍ الاستعادة…' : 'تنفيذ الاستعادة'}
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>إلغاء</button>
          </>
        )
      }
    >
      {error != null && <ErrorBox error={error} />}

      {result ? (
        <>
          <div className="alert ok">
            <span>✓</span>
            <div>تمت الاستعادة من نسخة بتاريخ {fmtDateTime(result.backupCreatedAt)}.</div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>الجدول</th><th>عدد السجلات</th></tr></thead>
              <tbody>
                {Object.entries(result.restored).map(([t, n]) => (
                  <tr key={t}><td className="mono">{t}</td><td className="num">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="alert error">
            <span>⚠</span>
            <div>
              <b>إجراء مدمّر لا رجعة فيه.</b> ستُمحى كل البيانات الحالية بالكامل وتُستبدل
              بمحتوى الملف. يُنصح بأخذ نسخة احتياطية من الحالة الراهنة أولًا.
            </div>
          </div>

          <div className="field">
            <label className="req">ملف النسخة الاحتياطية</label>
            <input ref={fileRef} type="file" accept=".gz,.json,application/gzip,application/json" />
            <div className="hint">ملف بصيغة <code>vero-backup-*.json.gz</code> صادر عن هذا النظام</div>
          </div>

          <div className="field">
            <label className="req">اكتب كلمة «استعادة» للتأكيد</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="استعادة" />
          </div>
        </>
      )}
    </Modal>
  );
}
