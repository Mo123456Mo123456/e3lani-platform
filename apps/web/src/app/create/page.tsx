import { getCategories, getCities, getPricing } from '@/lib/api';
import { CreateAdClient } from '@/components/create-ad-client';

export const metadata = { title: 'أضف إعلانًا' };

export default async function CreatePage() {
  const [categories, cities, pricing] = await Promise.all([
    getCategories().catch(() => []),
    getCities().catch(() => []),
    getPricing().catch(() => ({ items: [], publishingMode: 'FREE' as const, paymentsEnabled: false })),
  ]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[520px] border-x border-line bg-white">
      <CreateAdClient
        categories={categories}
        cities={cities}
        publishingMode={pricing.publishingMode}
        paymentsEnabled={pricing.paymentsEnabled}
      />
    </main>
  );
}
