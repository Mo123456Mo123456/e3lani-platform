'use client';

import { useState } from 'react';
import { api, type AuditEntry, type Paged } from '@/lib/api';
import { Shell } from '@/components/Shell';
import { Empty, ErrorBox, Loading, Modal, fmtDateTime, useData } from '@/components/ui';

const ACTION_AR: Record<string, string> = {
  'setup.complete': 'إتمام الإعداد الأول',
  'auth.login': 'تسجيل دخول',
  'auth.logout': 'تسجيل خروج',
  'company.update': 'تعديل بيانات الشركة',
  'company.logo.update': 'تغيير الشعار',
  'settings.set': 'تعديل إعداد',
  'user.create': 'إنشاء مستخدم',
  'user.update': 'تعديل مستخدم',
  'user.delete': 'حذف مستخدم',
  'vehicle.create': 'إضافة سيارة',
  'vehicle.update': 'تعديل سيارة',
  'vehicle.delete': 'حذف سيارة',
  'vehicle.assign_driver': 'تغيير السائق',
  'worker.create': 'إضافة عامل',
  'worker.update': 'تعديل عامل',
  'worker.delete': 'حذف عامل',
  'bin.create': 'إضافة حاوية',
  'bin.update': 'تعديل حاوية',
  'bin.delete': 'حذف حاوية',
  'bin.import': 'استيراد حاويات',
  'qr.stickers.generate': 'إنشاء ملصقات QR',
  'qr.mark_printed': 'تعليم QR كمطبوع',
  'qr.regenerate': 'إعادة توليد رمز QR',
  'device.activation_code.create': 'إنشاء كود تفعيل',
  'device.activate': 'تفعيل جهاز',
  'device.revoke': 'إلغاء تفعيل جهاز',
  'scan.record': 'تسجيل زيارة',
  'scan.review': 'مراجعة زيارة',
  'sla.create': 'إنشاء عقد SLA',
  'report.create': 'إصدار تقرير',
  'backup.create': 'إنشاء نسخة احتياطية',
  'backup.delete': 'حذف نسخة احتياطية',
  'backup.restore': 'استعادة نسخة احتياطية',
};

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const params = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (action) params.set('action', action);
  if (entity) params.set('entity', entity);

  const list = useData<Paged<AuditEntry>>(() => api(`/v1/audit?${params}`), [action, entity, page]);
  const actions = useData<{ items: string[] }>(() => api('/v1/audit/actions'));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <Shell title="سجل العمليات">
      <div className="alert info">
        <span>📋</span>
        <div>
          كل عملية حساسة مسجّلة: من نفّذها، ماذا فعل، متى، والقيم قبل وبعد.
          السجل للقراءة فقط ولا يمكن تعديله من الواجهة.
        </div>
      </div>

      <div className="toolbar">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">كل الإجراءات</option>
          {actions.data?.items.map((a) => (
            <option key={a} value={a}>{ACTION_AR[a] ?? a}</option>
          ))}
        </select>
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">كل الكيانات</option>
          <option value="bin">حاوية</option>
          <option value="scan">زيارة</option>
          <option value="vehicle">سيارة</option>
          <option value="worker">عامل</option>
          <option value="user">مستخدم</option>
          <option value="device">جهاز</option>
          <option value="report">تقرير</option>
          <option value="backup">نسخة احتياطية</option>
          <option value="company">الشركة</option>
        </select>
        <div className="spacer" />
        <button className="btn sm" onClick={list.reload}>تحديث</button>
      </div>

      <section className="card">
        {list.error != null ? (
          <div style={{ padding: 16 }}><ErrorBox error={list.error} onRetry={list.reload} /></div>
        ) : list.loading ? (
          <div style={{ padding: 16 }}><Loading rows={8} /></div>
        ) : !list.data || list.data.items.length === 0 ? (
          <Empty icon="📋" title="لا توجد سجلات مطابقة" />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>الوقت</th><th>الفاعل</th><th>الإجراء</th><th>الكيان</th><th>IP</th><th /></tr>
                </thead>
                <tbody>
                  {list.data.items.map((a) => (
                    <tr key={a.id}>
                      <td className="hint">{fmtDateTime(a.createdAt)}</td>
                      <td>{a.actorName ?? a.actorLabel ?? 'النظام'}</td>
                      <td style={{ fontWeight: 500 }}>{ACTION_AR[a.action] ?? a.action}</td>
                      <td className="hint mono">{a.entity}</td>
                      <td className="mono hint">{a.ip ?? '—'}</td>
                      <td style={{ textAlign: 'left' }}>
                        {Boolean(a.before ?? a.after) && (
                          <button className="btn sm" onClick={() => setDetail(a)}>التفاصيل</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
              <span className="hint">إجمالي <span className="num">{list.data.total}</span></span>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</button>
              <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>التالي</button>
            </div>
          </>
        )}
      </section>

      {detail && (
        <Modal title={ACTION_AR[detail.action] ?? detail.action} onClose={() => setDetail(null)}>
          <div className="hint" style={{ marginBottom: 10 }}>
            {fmtDateTime(detail.createdAt)} · {detail.actorName ?? detail.actorLabel ?? 'النظام'}
            {detail.entityId ? ` · ${detail.entity}#${detail.entityId.slice(0, 8)}` : ''}
          </div>
          {detail.before != null && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>قبل</div>
              <pre className="mono" style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, overflow: 'auto', fontSize: 11, maxHeight: 200 }}>
                {JSON.stringify(detail.before, null, 2)}
              </pre>
            </>
          )}
          {detail.after != null && (
            <>
              <div style={{ fontWeight: 600, margin: '10px 0 4px' }}>بعد</div>
              <pre className="mono" style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, overflow: 'auto', fontSize: 11, maxHeight: 200 }}>
                {JSON.stringify(detail.after, null, 2)}
              </pre>
            </>
          )}
        </Modal>
      )}
    </Shell>
  );
}
