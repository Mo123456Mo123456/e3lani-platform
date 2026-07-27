'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorMessage, PageHeader, StatusBadge } from '../../components/AdminUi';
import { api, getToken } from '../../lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({ slug: '', nameAr: '', nameEn: '', iconKey: '' });
  const [error, setError] = useState('');

  async function load() {
    if (!getToken()) {
      setError('سجّل الدخول أولًا');
      return;
    }
    setCategories(await api.adminCategories());
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function create() {
    await api.adminCreateCategory({ ...form, countryCode: 'SA' });
    setForm({ slug: '', nameAr: '', nameEn: '', iconKey: '' });
    await load();
  }

  async function toggle(id: string) {
    await api.adminToggleCategory(id);
    await load();
  }

  return (
    <div className="stack">
      <PageHeader title="التصنيفات" description="إدارة التصنيفات وحالة تفعيلها في feed والبحث." />
      <ErrorMessage message={error} />
      <div className="panel stack">
        <strong>إضافة تصنيف</strong>
        <div className="grid">
          <input
            className="input"
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))}
          />
          <input
            className="input"
            placeholder="الاسم العربي"
            value={form.nameAr}
            onChange={(e) => setForm((current) => ({ ...current, nameAr: e.target.value }))}
          />
          <input
            className="input"
            placeholder="English name"
            value={form.nameEn}
            onChange={(e) => setForm((current) => ({ ...current, nameEn: e.target.value }))}
          />
          <input
            className="input"
            placeholder="iconKey"
            value={form.iconKey}
            onChange={(e) => setForm((current) => ({ ...current, iconKey: e.target.value }))}
          />
        </div>
        <button className="btn btn-primary" onClick={create} disabled={!form.slug || !form.nameAr || !form.nameEn}>
          إضافة
        </button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>التصنيف</th>
              <th>slug</th>
              <th>الأيقونة</th>
              <th>الترتيب</th>
              <th>الحالة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <strong>{category.nameAr}</strong>
                  <div className="muted">{category.nameEn}</div>
                  {category.parent ? <small className="muted">فرعي من {category.parent.nameAr}</small> : null}
                </td>
                <td>{category.slug}</td>
                <td>{category.iconKey || '-'}</td>
                <td>{category.sortOrder}</td>
                <td>
                  <StatusBadge>{category.isActive ? 'ACTIVE' : 'INACTIVE'}</StatusBadge>
                </td>
                <td>
                  <button className="btn btn-ghost" onClick={() => toggle(category.id)}>
                    {category.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {categories.length === 0 && !error ? <EmptyState>لا توجد تصنيفات.</EmptyState> : null}
    </div>
  );
}
