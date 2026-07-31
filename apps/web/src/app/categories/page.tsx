import Link from 'next/link';
import { getCategories } from '@/lib/api';
import { SiteHeader } from '@/components/site-header';
import { BottomNav } from '@/components/bottom-nav';

export const metadata = { title: 'الأقسام' };

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      <SiteHeader activeTab="categories" />
      <div className="flex-1 space-y-3 p-3">
        {categories.map((category) => (
          <section key={category.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between">
              <Link href={`/search?categoryId=${category.id}`} className="text-base font-extrabold">
                {category.nameAr}
              </Link>
              <span className="rounded-pill bg-surface px-2.5 py-1 text-xs font-semibold text-ink-muted">
                {category.adsCount ?? 0} إعلان
              </span>
            </div>
            {category.children?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {category.children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/search?categoryId=${category.id}&subcategoryId=${sub.id}`}
                    className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-ink hover:text-ink"
                  >
                    {sub.nameAr}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <BottomNav active="categories" />
    </div>
  );
}
