'use client';

import * as React from 'react';
import type { CategoryDto, CityDto } from '@e3lani/types';
import { Badge, Button, Card, Input, Select } from '@e3lani/ui';
import { AdminShell, useCan } from '@/components/admin-shell';
import { adminFetch, API_URL } from '@/lib/admin-api';

export default function AdminCatalogPage() {
  const canWrite = useCan('catalog.write');
  const [categories, setCategories] = React.useState<CategoryDto[]>([]);
  const [cities, setCities] = React.useState<CityDto[]>([]);
  const [form, setForm] = React.useState({
    slug: '',
    nameAr: '',
    nameEn: '',
    parentId: '',
    sortOrder: '0',
  });
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [categoryRows, cityRows] = await Promise.all([
      fetch(`${API_URL}/categories`).then((response) => response.json() as Promise<CategoryDto[]>),
      fetch(`${API_URL}/cities`).then((response) => response.json() as Promise<CityDto[]>),
    ]);
    setCategories(categoryRows);
    setCities(cityRows);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await adminFetch('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          slug: form.slug,
          nameAr: form.nameAr,
          nameEn: form.nameEn,
          parentId: form.parentId || null,
          sortOrder: Number(form.sortOrder || 0),
          isActive: true,
        }),
      });
      setMessage('تم الحفظ');
      setForm({ slug: '', nameAr: '', nameEn: '', parentId: '', sortOrder: '0' });
      await load();
    } catch (error: any) {
      setMessage(error.message ?? 'تعذّر الحفظ');
    }
  };

  return (
    <AdminShell title="الأقسام والمدن">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-extrabold">الأقسام ({categories.length})</h2>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="rounded-md border border-line p-2">
                <p className="font-semibold">
                  {category.nameAr} <span className="text-xs text-ink-muted">/ {category.slug}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {category.children?.map((child) => (
                    <Badge key={child.id} tone="neutral">
                      {child.nameAr}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {canWrite ? (
            <Card className="space-y-3 p-4">
              <h2 className="font-extrabold">إضافة / تعديل قسم</h2>
              <form onSubmit={submit} className="space-y-3">
                <Input
                  label="المعرّف (لاتيني)"
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="الاسم بالعربية"
                    value={form.nameAr}
                    onChange={(event) => setForm({ ...form, nameAr: event.target.value })}
                    required
                  />
                  <Input
                    label="الاسم بالإنجليزية"
                    value={form.nameEn}
                    onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
                    required
                  />
                </div>
                <Select
                  label="القسم الأب (اتركه فارغًا لقسم رئيسي)"
                  value={form.parentId}
                  onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                >
                  <option value="">قسم رئيسي</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nameAr}
                    </option>
                  ))}
                </Select>
                <Input
                  label="الترتيب"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                />
                {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
                <Button type="submit">حفظ القسم</Button>
              </form>
            </Card>
          ) : null}

          <Card className="space-y-2 p-4">
            <h2 className="font-extrabold">المدن ({cities.length})</h2>
            <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto">
              {cities.map((city) => (
                <Badge key={city.id} tone={city.isPopular ? 'primary' : 'neutral'}>
                  {city.nameAr}
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
