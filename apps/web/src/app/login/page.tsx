import { Suspense } from 'react';
import { getCities } from '@/lib/api';
import { LoginClient } from '@/components/login-client';

export const metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage() {
  const cities = await getCities().catch(() => []);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[420px] px-5 py-10">
      <Suspense fallback={null}>
        <LoginClient cities={cities} />
      </Suspense>
    </main>
  );
}
