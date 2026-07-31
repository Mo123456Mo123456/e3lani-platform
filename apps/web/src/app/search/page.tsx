import { getCategories, getCities } from '@/lib/api';
import { SearchClient } from '@/components/search-client';
import { BottomNav } from '@/components/bottom-nav';

export const metadata = { title: 'البحث' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [categories, cities] = await Promise.all([
    getCategories().catch(() => []),
    getCities().catch(() => []),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col border-x border-line bg-white">
      <SearchClient categories={categories} cities={cities} initialParams={params} />
      <BottomNav active="home" />
    </div>
  );
}
