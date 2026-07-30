import Link from "next/link";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

type Category = {
  id: string;
  nameAr: string;
  icon: string | null;
  children: Array<{ id: string; nameAr: string }>;
};

export default async function CategoriesPage() {
  let categories: Category[] = [];
  try {
    const response = await fetch(`${api}/api/v1/catalog`, { cache: "no-store" });
    if (response.ok) categories = ((await response.json()) as { categories: Category[] }).categories;
  } catch {
    categories = [];
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black">الأقسام</h1>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <section key={category.id} className="rounded-2xl bg-white p-5">
            <Link href={`/?categoryId=${category.id}`} className="text-lg font-black">
              {category.nameAr}
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/?subcategoryId=${child.id}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm"
                >
                  {child.nameAr}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!categories.length && (
        <p className="mt-10 rounded-2xl bg-white p-8 text-center">
          تعذر تحميل الأقسام. تحقق من اتصال خدمة API.
        </p>
      )}
    </main>
  );
}
