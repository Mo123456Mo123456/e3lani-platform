import Link from 'next/link';
import { Card } from '@e3lani/ui';

export const metadata = { title: 'نتيجة الدفع' };

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const params = await searchParams;
  const succeeded = params.status === 'paid' || params.status === 'success';

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[420px] place-items-center p-6">
      <Card className="w-full space-y-3 p-6 text-center">
        <h1 className="text-xl font-extrabold">
          {succeeded ? 'تم استلام الدفع' : 'لم تكتمل عملية الدفع'}
        </h1>
        <p className="text-sm text-ink-muted">
          {succeeded
            ? 'سيتم تفعيل الخدمة خلال لحظات وستصلك رسالة تأكيد.'
            : 'يمكنك إعادة المحاولة من صفحة حسابي.'}
        </p>
        <Link href="/account" className="inline-block rounded-lg bg-primary px-6 py-3 font-bold text-ink">
          العودة لحسابي
        </Link>
      </Card>
    </main>
  );
}
