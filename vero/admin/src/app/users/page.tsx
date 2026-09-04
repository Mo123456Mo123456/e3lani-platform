'use client';

import { useState } from 'react';
import { api, type Role, type User } from '@/lib/api';
import { Shell } from '@/components/Shell';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  ROLE_AR,
  StatusPill,
  fmtDateTime,
  useData,
} from '@/components/ui';

const ROLE_HELP: Record<Role, string> = {
  ADMIN: 'كل الصلاحيات: المستخدمون، الحذف، النسخ الاحتياطي، سجل العمليات، هوية الشركة.',
  SUPERVISOR: 'التشغيل: الحاويات والسيارات والعمال والتقارير ومراجعة الزيارات. بلا حذف ولا نسخ احتياطي.',
  VIEWER: 'مشاهدة فقط: اللوحة والخريطة والتقارير. لا يستطيع تعديل أي شيء.',
};

export default function UsersPage() {
  const list = useData<{ items: User[] }>(() => api('/v1/users'));
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Shell title="المستخدمون والصلاحيات">
      <div className="alert info">
        <span>🔐</span>
        <div>
          الصلاحيات مطبّقة على الخادم لا في الواجهة فقط — الحساب المحدود لا يستطيع تنفيذ
          إجراء ممنوع حتى لو استُدعي الـAPI مباشرة.
        </div>
      </div>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>+ مستخدم جديد</button>
      </div>

      <section className="card">
        {list.error != null ? (
          <div style={{ padding: 16 }}><ErrorBox error={list.error} onRetry={list.reload} /></div>
        ) : list.loading ? (
          <div style={{ padding: 16 }}><Loading rows={4} /></div>
        ) : !list.data || list.data.items.length === 0 ? (
          <Empty icon="👤" title="لا يوجد مستخدمون" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th><th>اسم المستخدم</th><th>البريد</th>
                  <th>الدور</th><th>آخر دخول</th><th>الحالة</th><th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td className="mono">{u.username}</td>
                    <td className="mono hint">{u.email ?? '—'}</td>
                    <td><span className="pill info">{ROLE_AR[u.role]}</span></td>
                    <td className="hint">{fmtDateTime(u.lastLoginAt)}</td>
                    <td><StatusPill status={u.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td style={{ textAlign: 'left' }}>
                      <button className="btn sm" onClick={() => setEditing(u)}>تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(creating || editing) && (
        <UserForm
          user={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); list.reload(); }}
        />
      )}
    </Shell>
  );
}

function UserForm({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    role: (user?.role ?? 'VIEWER') as Role,
    isActive: user?.isActive ?? true,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api(`/v1/users/${user.id}`, {
          method: 'PATCH',
          body: {
            fullName: form.fullName,
            email: form.email || null,
            role: form.role,
            isActive: form.isActive,
            password: form.password || undefined,
          },
        });
      } else {
        await api('/v1/users', {
          method: 'POST',
          body: {
            fullName: form.fullName,
            username: form.username,
            email: form.email || null,
            role: form.role,
            password: form.password,
          },
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
    if (!user) return;
    if (!confirm(`حذف المستخدم ${user.fullName}؟`)) return;
    setBusy(true);
    try {
      await api(`/v1/users/${user.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) { setError(err); setBusy(false); }
  };

  const valid = form.fullName.length >= 2 &&
    (user ? true : /^[A-Za-z0-9._-]{3,}$/.test(form.username) && form.password.length >= 8) &&
    (form.password === '' || form.password.length >= 8);

  return (
    <Modal
      title={user ? user.fullName : 'مستخدم جديد'}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" onClick={save} disabled={busy || !valid}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn" onClick={onClose} disabled={busy}>إلغاء</button>
          <div style={{ flex: 1 }} />
          {user && <button className="btn danger" onClick={remove} disabled={busy}>حذف</button>}
        </>
      }
    >
      {error != null && <ErrorBox error={error} />}

      <Field label="الاسم الكامل" required>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </Field>

      <div className="row2">
        <Field label="اسم المستخدم" required hint={user ? 'لا يمكن تغييره' : 'أحرف إنجليزية وأرقام'}>
          <input
            className="mono" dir="ltr" value={form.username} disabled={Boolean(user)}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="البريد الإلكتروني">
          <input type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </div>

      <Field
        label={user ? 'كلمة مرور جديدة' : 'كلمة المرور'}
        required={!user}
        hint={user ? 'اتركها فارغة للإبقاء على الحالية. تغييرها يُنهي كل جلسات المستخدم.' : '8 أحرف على الأقل'}
      >
        <input type="password" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>

      <Field label="الدور" required hint={ROLE_HELP[form.role]}>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          <option value="ADMIN">مدير</option>
          <option value="SUPERVISOR">مشرف</option>
          <option value="VIEWER">مراقب</option>
        </select>
      </Field>

      {user && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox" style={{ width: 'auto' }} checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span style={{ fontSize: 13 }}>الحساب فعّال</span>
        </label>
      )}
    </Modal>
  );
}
